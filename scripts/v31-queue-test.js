'use strict';
/**
 * KamanTube v3.1 - live queue regression test (CDP, three phases).
 *
 * Reproduces the owner's v3.0.0 report "a file enters the queue but the
 * download never starts", including the deterministic restart case:
 *   prep:   force concurrency=1 and an empty saved queue, then the
 *           caller restarts the app so the setting takes effect.
 *   phase1: enqueue A (large - cannot finish during the test, starts
 *           downloading) and B (small - must stay queued behind A and
 *           be persisted). Caller kills the app mid-flight.
 *   phase2: relaunch; B must start downloading on its own (boot pump).
 *
 * Usage: node scripts/v31-queue-test.js prep|phase1|phase2
 * App must already be running with --remote-debugging-port=9222.
 */
const fs = require('fs');
const path = require('path');

const PORT = process.env.CDP_PORT || 9222;
const PHASE = process.argv[2];
const URL_A = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny, ~10 min
const URL_B = 'https://www.w3schools.com/html/mov_bbb.mp4'; // small direct mp4
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  - ' + extra : ''));
  if (!ok) failures++;
}

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && /renderer\/index\.html/.test(t.url || '')) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target on CDP');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  };
  const call = (method, params) => new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const ev = async (expr) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r && r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r && r.result ? r.result.value : undefined;
  };
  return { ev, ws };
}

async function fetchAndDownload(ev, url) {
  await ev(`document.querySelector('[data-page="new"]').click()`);
  await sleep(400);
  await ev(`(function(){const i=document.querySelector('#new-url');i.value=${JSON.stringify(url)};i.dispatchEvent(new Event('input'));document.querySelector('#new-fetch').click();})()`);
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    await sleep(2000);
    ok = await ev(`!!document.querySelector('#new-preview [data-role="download"]')`);
  }
  if (!ok) throw new Error('preview never rendered for ' + url);
  await ev(`document.querySelector('#new-preview [data-role="download"]').click()`);
  await sleep(600);
}

function dirSnapshot(dir) {
  try {
    return fs.readdirSync(dir).map((f) => {
      let s = 0;
      try { s = fs.statSync(path.join(dir, f)).size; } catch (_) { /* ignore */ }
      return { f, s };
    });
  } catch (_) { return []; }
}

const rowsExpr = `[...document.querySelectorAll('#queue-list .row-item')].map(el=>({t:el.querySelector('.row-title').textContent, st:el.querySelector('[data-f="status"]').textContent, pct:el.querySelector('[data-f="pct"]').textContent}))`;

async function main() {
  const { ev, ws } = await connect();
  await sleep(1500);
  const dlDir = await ev('window.kaman.getDownloads()');
  console.log('downloads dir:', dlDir);

  if (PHASE === 'prep') {
    await ev('window.kaman.settingSet("concurrency", 1)');
    await ev('window.kaman.settingSet("queueV3", [])');
    check('settings prepared (concurrency=1, queue cleared)', true);
  } else if (PHASE === 'phase1') {
    await fetchAndDownload(ev, URL_A);
    await fetchAndDownload(ev, URL_B);
    await ev(`document.querySelector('[data-page="queue"]').click()`);
    await sleep(1000);
    const rows = await ev(rowsExpr);
    console.log('queue rows:', JSON.stringify(rows));
    check('two jobs in queue', rows.length >= 2, String(rows.length));
    check('first job is downloading (pct visible)', rows.some((r) => r.pct && /\d/.test(r.pct)));
    check('second job waits queued (no pct yet)', rows.filter((r) => !(r.pct && /\d/.test(r.pct))).length >= 1);
    const snap = dirSnapshot(dlDir);
    check('a download file/.part exists on disk', snap.some((x) => /\.part$|\.mp4$/i.test(x.f) && x.s > 0), snap.map((x) => x.f).join(',').slice(0, 120));
  } else if (PHASE === 'phase2') {
    await ev(`document.querySelector('[data-page="queue"]').click()`);
    await sleep(1000);
    let started = false;
    let lastRows = [];
    for (let i = 0; i < 45 && !started; i++) {
      await sleep(2000);
      lastRows = await ev(rowsExpr);
      const now = dirSnapshot(dlDir);
      const bFile = now.some((x) => /mov_bbb/i.test(x.f) && x.s > 0); // B completed
      const partLive = now.some((x) => /\.part$/i.test(x.f) && x.s > 0); // something downloading
      const pctLive = lastRows.some((r) => r.pct && /\d/.test(r.pct));
      if (bFile || partLive || pctLive) started = true;
    }
    console.log('queue rows after restart:', JSON.stringify(lastRows));
    check('restored queued job started downloading after restart (boot pump)', started);
  } else {
    throw new Error('prep|phase1|phase2 required');
  }
  ws.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
