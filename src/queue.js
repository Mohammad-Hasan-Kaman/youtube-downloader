'use strict';
/**
 * KamanTube - download-queue ordering (shared, pure).
 *
 * The queue is priority-ordered, not plain FIFO:
 *   - every job carries a numeric `priority` (default 0) and an
 *     insertion sequence `seq`;
 *   - when a download slot frees, the pending job with the highest
 *     priority starts next; ties are broken by insertion order;
 *   - with every priority at the default, selection is exactly the old
 *     FIFO behaviour, so nothing changes until the user reorders.
 *
 * Pure functions over plain job objects - no DOM, no IPC - so the
 * renderer (window.KamanQueue) and the unit tests share one
 * implementation. Jobs already downloading are never selected here and
 * are never reordered by priority changes.
 */

function priorityOf(job) {
  const p = job && job.priority;
  return Number.isFinite(p) ? p : 0;
}

function seqOf(job, fallback) {
  const s = job && job.seq;
  return Number.isFinite(s) ? s : fallback;
}

/** The next job to start: highest priority, then earliest inserted. */
function pickNext(jobs) {
  let best = null;
  let bestP = -Infinity;
  let bestS = Infinity;
  let i = 0;
  for (const j of jobs || []) {
    const idx = i++;
    if (!j || j.status !== 'queued') continue;
    const p = priorityOf(j);
    const s = seqOf(j, idx);
    if (p > bestP || (p === bestP && s < bestS)) { best = j; bestP = p; bestS = s; }
  }
  return best;
}

/** Up to `count` jobs to start now, in the order they should start. */
function takeNext(jobs, count) {
  const out = [];
  const pool = [...(jobs || [])];
  while (out.length < Math.max(0, count || 0)) {
    const next = pickNext(pool);
    if (!next) break;
    out.push(next);
    pool.splice(pool.indexOf(next), 1);
  }
  return out;
}

/**
 * Raise (dir > 0) or lower (dir < 0) one queued job by one priority
 * level: it swaps levels with the nearest queued neighbour on that
 * side, or steps one past the end when it is already at the edge.
 * Mutates job.priority and returns the new value; a no-op for jobs
 * that are not queued (active jobs are never reordered).
 */
function movePriority(jobs, id, dir) {
  const list = [...(jobs || [])];
  const job = list.find((j) => j && j.id === id);
  if (!job) return 0;
  const mine = priorityOf(job);
  if (job.status !== 'queued' || !dir) return mine;
  const others = list
    .filter((j) => j && j !== job && j.status === 'queued')
    .map(priorityOf);
  if (dir > 0) {
    const above = others.filter((p) => p > mine);
    job.priority = above.length ? Math.min(...above) : mine + 1;
  } else {
    const below = others.filter((p) => p < mine);
    job.priority = below.length ? Math.max(...below) : mine - 1;
  }
  return job.priority;
}

// NOTE: this file is loaded as a classic <script> in the renderer,
// where top-level const/let share ONE global lexical scope across all
// scripts. providers.js already declares `const api` there - naming
// this one `api` too made the whole script fail with "Identifier 'api'
// has already been declared", window.KamanQueue stayed undefined, and
// every pump() in the renderer died on Q.takeNext: jobs queued forever
// and never downloaded (the v3.0.0 queue bug). Keep this name unique.
const queueApi = { priorityOf, seqOf, pickNext, takeNext, movePriority };
if (typeof module !== 'undefined' && module.exports) module.exports = queueApi;
if (typeof window !== 'undefined') window.KamanQueue = queueApi;
