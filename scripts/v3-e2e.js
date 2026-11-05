'use strict';
/**
 * KamanTube v3 - end-to-end extractor/download test over CDP.
 * search -> info (plain, then with the browser-session opt-in if the
 * plain call hits YouTube's bot check) -> platform probes -> a real
 * download of a 19-second public video, following engine events.
 *   node scripts/v3-e2e.js
 */
const PORT = process.env.CDP_PORT || 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && /renderer\/index\.html/.test(t.url || '')) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
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
  const probe = (label, expr) => ev(expr)
    .then((r) => console.log(label + ':', JSON.stringify(r)))
    .catch((e) => console.log(label + ': EVAL-ERR', String(e.message).slice(0, 130)));

  await probe('SEARCH', `window.kaman.search('me at the zoo', '').then(r => ({n: r.length, first: r[0] && r[0].title}))`);

  let useCookies = false;
  try {
    const info = await ev(`window.kaman.info('https://www.youtube.com/watch?v=jNQXAC9IVRw', '').then(r => ({type: r.type, title: r.title, quals: (r.qualities||[]).map(q=>q.height), subs: (r.subtitles||[]).length}))`);
    console.log('INFO plain:', JSON.stringify(info));
  } catch (e) {
    console.log('INFO plain failed:', String(e.message).slice(0, 110));
    const info2 = await ev(`window.kaman.info('https://www.youtube.com/watch?v=jNQXAC9IVRw', '', {cookiesBrowser: 'chrome'}).then(r => ({type: r.type, title: r.title, quals: (r.qualities||[]).map(q=>q.height), subs: (r.subtitles||[]).length}))`)
      .catch((e2) => ({ error: String(e2.message).slice(0, 110) }));
    console.log('INFO chrome-cookies:', JSON.stringify(info2));
    useCookies = !info2.error;
  }

  await probe('PINTEREST', `window.kaman.info('https://www.pinterest.com/pin/99360735500167749/', '').then(r => ({type: r.type, title: (r.title||'').slice(0,50)})).catch(e => ({error: String(e).slice(0,110)}))`);
  await probe('TIKTOK', `window.kaman.info('https://www.tiktok.com/@tiktok/video/7106594312292453675', '').then(r => ({type: r.type, title: (r.title||'').slice(0,50)})).catch(e => ({error: String(e).slice(0,110)}))`);
  await probe('X', `window.kaman.info('https://x.com/NASA/status/1858999509379346779', '').then(r => ({type: r.type, title: (r.title||'').slice(0,50)})).catch(e => ({error: String(e).slice(0,110)}))`);

  const dlExpr = `(async () => {
    const events = [];
    window.__dlEvents = events;
    window.kaman.onYtEvent(e => { if (e.id === window.__dlId) events.push(e.type + (e.type==='progress' ? ':' + Math.floor(e.pct) : '')); });
    const dir = await window.kaman.getDownloads();
    const job = { id: 'e2e' + Date.now(), url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Me at the zoo', kind: 'video', formatId: 'best', subsMode: 'disabled', thumbMode: 'embedded', outDir: dir };
    if (__USE_COOKIES__) job.cookiesBrowser = 'chrome';
    window.__dlId = await window.kaman.download(job, '');
    return window.__dlId;
  })()`.replace('__USE_COOKIES__', useCookies ? 'true' : 'false');
  const dl = await ev(dlExpr);
  console.log('DOWNLOAD ID:', dl, '| cookies:', useCookies);
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const st = await ev(`({n: window.__dlEvents.length, last: window.__dlEvents.slice(-3), done: window.__dlEvents.includes('done'), err: window.__dlEvents.filter(x=>x==='error')})`);
    console.log('EVENTS:', JSON.stringify(st));
    if (st.done) { console.log('E2E DOWNLOAD: DONE'); break; }
    if (st.err && st.err.length) { console.log('E2E DOWNLOAD: ERROR'); break; }
    if (i === 39) console.log('E2E DOWNLOAD: TIMEOUT');
  }
  ws.close();
}

main().catch((e) => { console.error('E2E ERROR', e.message); process.exit(2); });
