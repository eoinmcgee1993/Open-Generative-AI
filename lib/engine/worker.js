// Server-side generation worker. Submits a job to muapi and polls for the
// result, updating the in-memory job store as it goes. Runs as a
// fire-and-forget promise so the HTTP response is returned immediately.
// This means the generation continues even if the browser tab closes.

import { updateJob } from './store.js';

const MUAPI_BASE = 'https://api.muapi.ai';
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 900; // 30 minutes at 2s intervals

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function runJob(job, endpoint, payload) {
  updateJob(job.id, { status: 'running' });

  try {
    // ── Submit ──────────────────────────────────────────────────────────────
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
      throw new Error(`Submit failed (${submitRes.status}): ${text.slice(0, 200)}`);
    }

    const submitData = await submitRes.json();
    const requestId = submitData.request_id || submitData.id;

    if (!requestId) {
      // Some endpoints return the result directly (no polling needed)
      const url = submitData.url || submitData.outputs?.[0] || submitData.output?.url;
      updateJob(job.id, { status: 'done', url, requestId: null, completedAt: Date.now() });
      return;
    }

    updateJob(job.id, { requestId, status: 'running' });

    // ── Poll ────────────────────────────────────────────────────────────────
    const pollUrl = `${MUAPI_BASE}/api/v1/predictions/${requestId}/result`;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      try {
        const pollRes = await fetch(pollUrl, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': job.apiKey,
          },
        });

        if (!pollRes.ok) {
          if (pollRes.status >= 500) continue; // transient server error
          const text = await pollRes.text().catch(() => '');
          throw new Error(`Poll failed (${pollRes.status}): ${text.slice(0, 200)}`);
        }

        const data = await pollRes.json();
        const status = data.status?.toLowerCase();

        if (status === 'completed' || status === 'succeeded' || status === 'success') {
          const url = data.outputs?.[0] || data.url || data.output?.url;
          updateJob(job.id, { status: 'done', url, completedAt: Date.now() });
          return;
        }

        if (status === 'failed' || status === 'error') {
          throw new Error(data.error || 'Generation failed with unknown error');
        }
        // else: still pending — keep polling
      } catch (err) {
        // Re-throw only on the final attempt
        if (attempt >= MAX_ATTEMPTS - 1) throw err;
        // Otherwise absorb transient network errors and keep going
      }
    }

    throw new Error('Generation timed out after 30 minutes');
  } catch (err) {
    updateJob(job.id, {
      status: 'error',
      error: err.message,
      completedAt: Date.now(),
    });
  }
}
