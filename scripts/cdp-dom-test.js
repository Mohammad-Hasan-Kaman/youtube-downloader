// Direct DOM test using Page domain
const PORT = process.argv[2] || '9228';
(async () => {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find(t => t.title === 'KamanTube');
  if (!page) { console.error('NO PAGE'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const o = JSON.parse(ev.data); if (o.id && pending.has(o.id)) pending.get(o.id)(o.result); };
  const send = (m, p) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
  
  // Enable Page domain and navigate
  await send('Page.enable', {});
  await new Promise(r => setTimeout(r, 2000));
  
  // Test DOM via Page.evaluate (has access to document)
  const tests = [
    ['FA home', 'document.querySelector(\'.nav-btn[data-view="home"]\').textContent'],
    ['RTL dir', 'document.documentElement.dir'],
    ['Search results', 'document.querySelectorAll(\'.grid-item\').length'],
    ['Settings pane', 'document.querySelector(\'#pane-settings\') !== null'],
    ['Theme attr', 'document.documentElement.dataset.theme'],
  ];
  
  for (const [name, expr] of tests) {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, contextId: 1 });
      console.log(`${r.result.value ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(r.result.value)}`);
    } catch(e) {
      console.log(`ERROR ${name}: ${e.message}`);
    }
  }
  
  // Test language switch
  console.log('\n--- Language switch test ---');
  await send('Runtime.evaluate', { expression: 'document.querySelector(\'.seg-b[data-lang="en"]\').click()' });
  await new Promise(r => setTimeout(r, 800));
  const enDir = await send('Runtime.evaluate', { expression: 'document.documentElement.dir' });
  console.log(`After EN: dir=${enDir.result.value}`);
  
  await send('Runtime.evaluate', { expression: 'document.querySelector(\'.seg-b[data-lang="fa"]\').click()' });
  await new Promise(r => setTimeout(r, 800));
  const faDir = await send('Runtime.evaluate', { expression: 'document.documentElement.dir' });
  console.log(`After FA: dir=${faDir.result.value}`);
  
  // Test theme
  console.log('\n--- Theme test ---');
  await send('Runtime.evaluate', { expression: 'document.querySelector(\'[data-theme="light"]\').click()' });
  await new Promise(r => setTimeout(r, 500));
  const themeAfter = await send('Runtime.evaluate', { expression: 'document.documentElement.dataset.theme' });
  console.log(`Theme after click: ${themeAfter.result.value}`);
  
  ws.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
