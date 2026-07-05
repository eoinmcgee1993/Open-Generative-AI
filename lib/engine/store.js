// Global in-memory job store. Uses globalThis so the Map survives Next.js
// hot reloads in development (where modules re-evaluate but the global
// persists). On a long-running process (next start / Docker) it simply lives
// in memory across all requests.
//
// Trade-off accepted: jobs are lost if the process restarts. For video
// generation that is acceptable — muapi already holds the result URL, and
// completed jobs are stored as downloadable links the user can save.

const g = globalThis;
if (!g.__engineJobStore) g.__engineJobStore = new Map();
const store = g.__engineJobStore;

export function createJob({ prompt, model, type, apiKey }) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued', // queued | running | done | error
    prompt: prompt || '',
    model,
    type: type || 't2v',
    url: null,
    error: null,
    requestId: null, // muapi request_id — needed for Seedance extend
    createdAt: Date.now(),
    completedAt: null,
    apiKey, // stored for polling auth; never returned to client
  };
  store.set(id, job);
  return job;
}

export function updateJob(id, patch) {
  const job = store.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function getJob(id) {
  return store.get(id) ?? null;
}

export function listJobs(apiKey) {
  return [...store.values()]
    .filter(j => j.apiKey === apiKey)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100);
}

// Strip apiKey from the object before sending to the client
export function publicJob(job) {
  if (!job) return null;
  const { apiKey: _, ...safe } = job;
  return safe;
}
