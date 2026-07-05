import { NextResponse } from 'next/server';
import { getJob, publicJob } from '@/lib/engine/store';
import { checkJob } from '@/lib/engine/worker';

function getApiKey(request) {
  return (
    request.headers.get('x-api-key') ||
    request.cookies.get('muapi_key')?.value ||
    null
  );
}

export async function GET(request, { params }) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.apiKey !== apiKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Drive muapi polling on-demand: each client poll triggers one muapi check.
  // This keeps the engine serverless-compatible — no background threads needed.
  await checkJob(job);

  return NextResponse.json(publicJob(getJob(jobId)));
}
