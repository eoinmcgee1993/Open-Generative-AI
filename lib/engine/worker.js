// Server-side generation worker — serverless-compatible.
//
// submitJob: awaitable, handles muapi submission and stores requestId.
//   Called from the generate route; completes in one HTTP round-trip.
//
// checkJob: single muapi status check.
//   Called from the job status route so each client poll drives one muapi query.
//   No background threads needed — works on any serverless platform.

import { updateJob } from './store.js';

const MUAPI_BASE = 'https://api.muapi.ai';

export async function submitJob(job, endpoint, payload) {
  updateJob(job.id, { status: 'running' });

  try {
    const submitRes = await fetch(`${MUAPI_BASE}/api/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': job.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text().catch(() => '');
      updateJob(job.id, {
        status: 'error',
        error: `Submit failed (${submitRes.status}): ${text.slice(0, 200)}`,
        completedAt: Date.now(),
      });
      return;
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id || submitData.id;

    if (!requestId) {
      // Some endpoints return the result directly — no polling needed
      const url = submitData.url || submitData.outputs?.[0] || submitData.output?.url;
      updateJob(job.id, { status: 'done', url, requestId: null, completedAt: Date.now() });
      return;
    }

    updateJob(job.id, { requestId, status: 'running' });
  } catch (err) {
    updateJob(job.id, {
      status: 'error',
      error: err.message || 'Submit failed',
      completedAt: Date.now(),
    });
  }
}

// Called by the status endpoint on each client poll.
// Makes a single muapi status check and updates the store if complete/failed.
// No-ops if the job is already done/errored or has no requestId.
export async function checkJob(job) {
  if (!job.requestId || job.status === 'done' || job.status === 'error') return;

  try {
    const pollRes = await fetch(
      `${MUAPI_BASE}/api/v1/predictions/${job.requestId}/result`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': job.apiKey,
        },
      },
    );

    if (!pollRes.ok) return; // transient — client will retry

    const data = await pollRes.json();
    const status = data.status?.toLowerCase();

    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      const url = data.outputs?.[0] || data.url || data.output?.url;
      updateJob(job.id, { status: 'done', url, completedAt: Date.now() });
    } else if (status === 'failed' || status === 'error') {
      updateJob(job.id, {
        status: 'error',
        error: data.error || 'Generation failed with unknown error',
        completedAt: Date.now(),
      });
    }
    // else: still pending — no update, client retries
  } catch {
    // transient network error — ignore, client will retry
  }
}
