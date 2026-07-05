import { NextResponse } from 'next/server';
import { listJobs, publicJob } from '@/lib/engine/store';

function getApiKey(request) {
  return (
    request.headers.get('x-api-key') ||
    request.cookies.get('muapi_key')?.value ||
    null
  );
}

export async function GET(request) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 });
  }

  const jobs = listJobs(apiKey).map(publicJob);
  return NextResponse.json(jobs);
}
