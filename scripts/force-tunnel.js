// force tunnel via CDP: click the "Always on" mode in settings
(async () => {
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const page = list.find((t) => t.title === 'KamanTube');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const o = JSON.parse(ev.data); if (o.id && pending.has(o.id)) { pending.get(o.id)(o.result); pending.delete(o.id); } };
  const send = (m, p) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(r => r.result.value);
  // switch to settings pane and set tunnel mode to forced
  await ev(`document.querySelector('.nav-btn[data-view="settings"]').click()`);
  await new Promise(r => setTimeout(r, 300));
  await ev(`(function(){ const s = document.querySelector('#s-tunnel-mode'); s.value='forced'; s.dispatchEvent(new Event('change')); return s.value; })()`);
  console.log('tunnel mode ->', await ev(`document.querySelector('#s-tunnel-mode').value`));
  // wait and read net state
  await new Promise(r => setTimeout(r, 15000));
  console.log('net:', JSON.stringify(await ev(`({ip: document.querySelector('#net-ip').textContent, state: document.querySelector('#net-state').textContent})`)));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
