'use strict';
/** Grab a screenshot of the app renderer over CDP (Page.captureScreenshot). */
const fs = require('fs');

const TARGET = process.argv[2];
const OUT = process.argv[3];

async function main() {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  const url = page ? page.webSocketDebuggerUrl : `ws://127.0.0.1:9222/devtools/page/${TARGET}`;
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const call = (id, method, params) => new Promise((res) => {
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) res(m.result);
    };
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  if (process.argv[2] === 'reload') {
    await call(9, 'Page.reload', {});
    await new Promise((r) => setTimeout(r, 2500));
  }
  const shot = await call(1, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('saved', OUT);
  ws.close();
}

main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
