(async () => {
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const page = list.find((t) => t.title === 'KamanTube');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const o = JSON.parse(ev.data); if (o.id && pending.has(o.id)) { pending.get(o.id)(o.result); pending.delete(o.id); } };
  const send = (m, p) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then(r => r.result.value);
  const r1 = await ev(`window.kaman.tunnelModeSet('forced').then(() => window.kaman.tunnelModeGet())`);
  console.log('direct IPC tunnelModeSet ->', r1);
  await new Promise(r => setTimeout(r, 2000));
  const st = await ev(`window.kaman.tunnelGet()`);
  console.log('tunnelGet:', JSON.stringify(st));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
