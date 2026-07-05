import { NextResponse } from 'next/server';
import { createJob } from '@/lib/engine/store';
import { runJob } from '@/lib/engine/worker';
import {
  getVideoModelById,
  getI2VModelById,
  getV2VModelById,
} from 'studio/src/models.js';

function getApiKey(request) {
  return (
    request.headers.get('x-api-key') ||
    request.cookies.get('muapi_key')?.value ||
    null
  );
}

function buildPayload(type, body, modelInfo) {
  const {
    prompt, aspect_ratio, duration, resolution, quality, mode, seed,
    image_url, last_image, video_url, request_id,
  } = body;

  const payload = {};

  if (type === 'v2v') {
    // V2V: video is the primary input
    const videoField = modelInfo?.videoField || 'video_url';
    if (video_url) payload[videoField] = video_url;
    const imageField = modelInfo?.imageField;
    if (imageField && image_url) payload[imageField] = image_url;
    if (modelInfo?.hasPrompt && prompt) payload.prompt = prompt;
    return payload;
  }

  if (type === 'i2v') {
    // I2V: image is the primary input
    const imageField = modelInfo?.imageField || 'image_url';
    if (image_url) {
      if (imageField === 'images_list') payload.images_list = [image_url];
      else payload[imageField] = image_url;
    }
    const lastImageField = modelInfo?.lastImageField;
    if (lastImageField && last_image) payload[lastImageField] = last_image;
    if (prompt) payload.prompt = prompt;
    if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
    if (duration) payload.duration = duration;
    if (resolution) payload.resolution = resolution;
    if (quality) payload.quality = quality;
    if (mode) payload.mode = mode;
    return payload;
  }

  // T2V (default)
  if (prompt) payload.prompt = prompt;
  if (request_id) payload.request_id = request_id; // Seedance extend
  if (!request_id && aspect_ratio) payload.aspect_ratio = aspect_ratio;
  if (duration) payload.duration = duration;
  if (resolution) payload.resolution = resolution;
  if (quality) payload.quality = quality;
  if (mode) payload.mode = mode;
  if (image_url) payload.image_url = image_url;
  if (seed && seed !== -1) payload.seed = seed;
  return payload;
}

export async function POST(request) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { model, type = 't2v', prompt } = body;
  if (!model) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 });
  }

  // Resolve endpoint and model info
  let modelInfo;
  if (type === 'v2v') {
    modelInfo = getV2VModelById(model);
  } else if (type === 'i2v') {
    modelInfo = getI2VModelById(model);
  } else {
    modelInfo = getVideoModelById(model);
  }
  const endpoint = modelInfo?.endpoint || model;

  const payload = buildPayload(type, body, modelInfo);

  const job = createJob({ prompt, model, type, apiKey });

  // Fire-and-forget: the worker keeps running even if the browser disconnects
  runJob(job, endpoint, payload).catch(() => {});

  return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
}
