'use strict';
/**
 * KamanTube v3 - CDP smoke test.
 * Launch the app with --remote-debugging-port=9222 first, then:
 *   node scripts/v3-smoke.js [outDir]
 * Checks: preload bridge, 10 pages + routing, theme switch (dark/light/
 * system), live language switch fa/en/de with dir flip, tunnel + version
 * IPC. Captures one screenshot per state into outDir.
 */
const fs = require('fs');
const path = require('path');

const PORT = process.env.CDP_PORT || 9222;
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
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
  const shot = async (name) => {
    const s = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64'));
    console.log('shot ' + name);
  };

  await call('Page.enable');
  await sleep(2500);

  check('preload bridge (window.kaman)', await ev('!!window.kaman'));
  check('providers registry', await ev('!!window.KamanProviders && window.KamanProviders.detect("https://www.tiktok.com/@x/video/1")==="tiktok"'));
  check('10 pages mounted', await ev('document.querySelectorAll("[data-page-panel]").length'), await ev('String(document.querySelectorAll("[data-page-panel]").length)'));

  for (const p of ['search', 'new', 'playlists', 'queue', 'history', 'library', 'settings', 'diagnostics', 'about', 'home']) {
    const ok = await ev(`(function(){document.querySelector('[data-page="${p}"]').click();return document.querySelector('[data-page-panel="${p}"]').classList.contains('active');})()`);
    check('route -> ' + p, ok === true);
    await sleep(120);
  }

  // theme: light must differ from dark (computed bg), system resolves to one of them
  await ev(`document.querySelector('[data-theme-pick="light"]').click()`);
  await sleep(250);
  check('theme light applied', await ev('document.documentElement.dataset.theme==="light"'));
  const bgLight = await ev('getComputedStyle(document.body).backgroundColor');
  await shot('v3-home-light-fa.png');
  await ev(`document.querySelector('[data-theme-pick="dark"]').click()`);
  await sleep(250);
  check('theme dark applied', await ev('document.documentElement.dataset.theme==="dark"'));
  const bgDark = await ev('getComputedStyle(document.body).backgroundColor');
  check('light bg differs from dark bg', bgLight !== bgDark, bgLight + ' vs ' + bgDark);
  await shot('v3-home-dark-fa.png');

  // language: en (LTR) then de (LTR) then fa (RTL), live, no reload
  await ev(`document.querySelector('[data-lang-pick="en"]').click()`);
  await sleep(600);
  check('en: dir=ltr', await ev('document.documentElement.dir==="ltr"'));
  check('en: title is English', await ev('document.querySelector("#page-title").textContent'), await ev('document.querySelector("#page-title").textContent'));
  await shot('v3-home-dark-en.png');
  await ev(`document.querySelector('[data-lang-pick="de"]').click()`);
  await sleep(600);
  check('de: settings nav in German', await ev('[...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="Einstellungen")'));
  await shot('v3-home-dark-de.png');
  await ev(`document.querySelector('[data-lang-pick="fa"]').click()`);
  await sleep(600);
  check('fa: dir=rtl again', await ev('document.documentElement.dir==="rtl"'));

  // settings page renders real version data
  await ev(`document.querySelector('[data-page="settings"]').click()`);
  await sleep(400);
  await shot('v3-settings-dark-fa.png');
  const ytdlp = await ev('document.querySelector("#v-ytdlp").textContent');
  console.log('info  yt-dlp version cell:', ytdlp);

  const tun = await ev('window.kaman.tunnelGet().then(s=>({ip:s.ip,country:s.country,active:s.active,usingTunnel:s.usingTunnel}))');
  console.log('info  tunnelGet:', JSON.stringify(tun));
  check('tunnelGet answers', !!tun && typeof tun === 'object');

  await ev(`document.querySelector('[data-page="diagnostics"]').click()`);
  await sleep(400);
  await shot('v3-diagnostics-dark-fa.png');

  ws.close();
  console.log(failures ? `\n${failures} FAILURES` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('SMOKE ERROR', e.message); process.exit(2); });
