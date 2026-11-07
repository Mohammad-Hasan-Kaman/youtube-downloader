'use strict';
/**
 * Regression test for the v3.0.0 "queue never downloads" bug.
 *
 * renderer/index.html loads src/providers.js and src/queue.js as
 * classic scripts before app.js. Classic scripts share one global
 * lexical scope, so a duplicated top-level `const` name makes the
 * later script fail ENTIRELY. Both files declared `const api`:
 * queue.js died, window.KamanQueue stayed undefined, and every
 * pump() call in the renderer threw on Q.takeNext - jobs entered
 * the queue and never started.
 *
 * This test runs both files in one vm context (the browser's
 * shared-scope semantics) and asserts both globals survive.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('renderer scripts: providers + queue globals coexist in one scope', () => {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const f of ['providers.js', 'queue.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  assert.ok(ctx.window.KamanProviders, 'window.KamanProviders missing');
  assert.ok(ctx.window.KamanQueue, 'window.KamanQueue missing');
  assert.equal(typeof ctx.window.KamanQueue.takeNext, 'function');
  assert.equal(typeof ctx.window.KamanProviders.isBlocked, 'function');
});
