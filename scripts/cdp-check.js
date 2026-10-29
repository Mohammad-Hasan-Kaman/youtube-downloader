// CDP smoke test for KamanTube fixes
// Usage: node scripts/cdp-check.js [port]
'use strict';

const PORT = process.argv[2] || '9224';

let msgId = 0;
let ws = null;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

(async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.title === 'KamanTube') || list.find((t) => t.type === 'page' && !t.url.includes('devtools'));
  if (!page) { console.error('NO PAGE'); process.exit(1); }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const o = JSON.parse(ev.data);
    if (o.id && pending.has(o.id)) {
      const { res, rej } = pending.get(o.id);
      pending.delete(o.id);
      o.error ? rej(new Error(o.error.message)) : res(o.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  // 1. settings pane exists
  console.log('settings nav:', await evalJS(`document.querySelector('.nav-btn[data-view="settings"]').textContent`));

  await evalJS(`document.querySelector('.nav-btn[data-view="settings"]').click()`);
  await new Promise((r) => setTimeout(r, 300));
  console.log('settings pane active:', await evalJS(`document.querySelector('#pane-settings').classList.contains('active')`));
  console.log('theme buttons:', await evalJS(`[...document.querySelectorAll('[data-theme]')].map(b => b.dataset.theme + ':' + b.classList.contains('active'))`));

  // 2. theme switch to light
  await evalJS(`document.querySelector('[data-theme="light"]').click()`);
  await new Promise((r) => setTimeout(r, 300));
  console.log('theme after click:', await evalJS(`document.documentElement.dataset.theme`));

  // 3. scroll capability
  console.log('scroll works:', await evalJS(`(() => {
    const v = document.querySelector('#view-body');
    const probe = document.createElement('div');
    probe.style.height = '3000px';
    document.querySelector('#pane-settings').appendChild(probe);
    const ok = v.scrollHeight > v.clientHeight;
    probe.remove();
    return ok + ' (scrollH=' + v.scrollHeight + ' clientH=' + v.clientHeight + ')';
  })()`));

  // 4. language switch to EN
  await evalJS(`document.querySelector('.seg-b[data-lang="en"]').click()`);
  await new Promise((r) => setTimeout(r, 600));
  console.log('after EN:', JSON.stringify(await evalJS(`({dir: document.documentElement.dir, lang: document.documentElement.lang, settings: document.querySelector('.nav-btn[data-view="settings"]').textContent, themeLight: document.querySelector('[data-theme="light"]').textContent, openFolder: document.querySelector('#btn-open-folder').textContent})`)));

  // 5. back to FA
  await evalJS(`document.querySelector('.seg-b[data-lang="fa"]').click()`);
  await new Promise((r) => setTimeout(r, 600));
  console.log('after FA:', JSON.stringify(await evalJS(`({dir: document.documentElement.dir, settings: document.querySelector('.nav-btn[data-view="settings"]').textContent})`)));

  // 6. net chip
  console.log('net chip:', JSON.stringify(await evalJS(`({ip: document.querySelector('#net-ip').textContent, state: document.querySelector('#net-state').textContent, dot: document.querySelector('#net-dot').className})`)));

  // 7. tunnel mode select
  console.log('tunnel mode options:', await evalJS(`[...document.querySelectorAll('#s-tunnel-mode option')].map(o => o.value + '=' + o.textContent)`));

  // reset theme to dark for the next run
  await evalJS(`document.querySelector('[data-theme="dark"]').click()`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
