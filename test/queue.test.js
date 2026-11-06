'use strict';
/**
 * Unit tests for src/queue.js - the shared next-job selection:
 * highest priority first, insertion order breaks ties, and jobs that
 * are already running are never selected or reordered.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Q = require('../src/queue');

const job = (id, over) => ({ id, status: 'queued', priority: 0, seq: 0, ...over });

test('defaults: equal priorities start in insertion order (the old FIFO)', () => {
  const jobs = [job('a', { seq: 1 }), job('b', { seq: 2 }), job('c', { seq: 3 })];
  assert.equal(Q.pickNext(jobs).id, 'a');
  assert.deepEqual(Q.takeNext(jobs, 2).map((j) => j.id), ['a', 'b']);
});

test('missing priority/seq fall back to 0 and array order', () => {
  const jobs = [{ id: 'a', status: 'queued' }, { id: 'b', status: 'queued' }];
  assert.equal(Q.pickNext(jobs).id, 'a');
  assert.equal(Q.priorityOf(jobs[0]), 0);
});

test('highest priority starts first; insertion order breaks priority ties', () => {
  const jobs = [
    job('a', { seq: 1, priority: 0 }),
    job('b', { seq: 2, priority: 5 }),
    job('c', { seq: 3, priority: 5 }),
    job('d', { seq: 4, priority: -1 }),
  ];
  assert.deepEqual(Q.takeNext(jobs, 4).map((j) => j.id), ['b', 'c', 'a', 'd']);
});

test('seq decides, not array position', () => {
  const jobs = [job('late', { seq: 9 }), job('early', { seq: 2 })];
  assert.equal(Q.pickNext(jobs).id, 'early');
});

test('active and finished jobs are never selected', () => {
  const jobs = [
    job('run', { status: 'downloading', priority: 99, seq: 1 }),
    job('done', { status: 'done', priority: 99, seq: 2 }),
    job('wait', { priority: 0, seq: 3 }),
  ];
  assert.equal(Q.pickNext(jobs).id, 'wait');
  assert.deepEqual(Q.takeNext(jobs, 5).map((j) => j.id), ['wait']);
  assert.equal(Q.pickNext([]), null);
  assert.equal(Q.pickNext([job('x', { status: 'paused' })]), null);
});

test('takeNext honours the free-slot count and does not mutate the input', () => {
  const jobs = [job('a', { seq: 1 }), job('b', { seq: 2 }), job('c', { seq: 3 })];
  assert.deepEqual(Q.takeNext(jobs, 0), []);
  assert.deepEqual(Q.takeNext(jobs, 2).map((j) => j.id), ['a', 'b']);
  assert.equal(jobs.length, 3);
});

test('movePriority swaps with the nearest queued level and steps past the edge', () => {
  const jobs = [job('a', { seq: 1 }), job('b', { seq: 2 }), job('c', { seq: 3 })];
  // raise c above the shared default level
  assert.equal(Q.movePriority(jobs, 'c', 1), 1);
  assert.equal(Q.pickNext(jobs).id, 'c');
  // raise a onto c's level; a was inserted first, so it wins the tie
  assert.equal(Q.movePriority(jobs, 'a', 1), 1);
  assert.equal(Q.pickNext(jobs).id, 'a');
  // lower c back under a
  assert.equal(Q.movePriority(jobs, 'c', -1), 0);
  assert.equal(Q.pickNext(jobs).id, 'a');
  // lowering the lowest job drops it under everyone
  assert.equal(Q.movePriority(jobs, 'b', -1), -1);
  assert.deepEqual(Q.takeNext(jobs, 3).map((j) => j.id), ['a', 'c', 'b']);
});

test('movePriority never touches a job that is already downloading', () => {
  const jobs = [job('run', { status: 'downloading', priority: 3 }), job('q', { seq: 2 })];
  assert.equal(Q.movePriority(jobs, 'run', 1), 3);
  assert.equal(jobs[0].priority, 3);
  assert.equal(Q.movePriority(jobs, 'missing', 1), 0);
});
