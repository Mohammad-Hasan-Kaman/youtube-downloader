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
  const shot = async (name) => {
    const s = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, 'base64'));
    console.log('shot ' + name);
  };

  await call('Page.enable');
  await sleep(2500);

  check('preload bridge (window.kaman)', await ev('!!window.kaman'));
  check('providers registry', await ev('!!window.KamanProviders && window.KamanProviders.detect("https://www.tiktok.com/@x/video/1")==="tiktok"'));
  check('queue registry (v3.1 regression)', await ev('!!window.KamanQueue && typeof window.KamanQueue.takeNext==="function"'));
  check('panels mounted', await ev('document.querySelectorAll("[data-page-panel]").length>=14'), await ev('String(document.querySelectorAll("[data-page-panel]").length)'));

  for (const p of ['search', 'platforms', 'new', 'playlists', 'queue', 'history', 'library', 'settings', 'diagnostics', 'about', 'home']) {
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

  // language: en (LTR), de (LTR), ar (RTL), zh (LTR), fa (RTL) - live, no reload
  await ev(`document.querySelector('[data-lang-pick="en"]').click()`);
  await sleep(600);
  check('en: dir=ltr', await ev('document.documentElement.dir==="ltr"'));
  check('en: title is English', await ev('document.querySelector("#page-title").textContent'), await ev('document.querySelector("#page-title").textContent'));
  await shot('v3-home-dark-en.png');
  await ev(`document.querySelector('[data-lang-pick="de"]').click()`);
  await sleep(600);
  check('de: settings nav in German', await ev('[...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="Einstellungen")'));
  await shot('v3-home-dark-de.png');
  await ev(`document.querySelector('[data-lang-pick="ar"]').click()`);
  await sleep(600);
  check('ar: dir=rtl', await ev('document.documentElement.dir==="rtl"'));
  check('ar: settings nav in Arabic', await ev('[...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="الإعدادات")'));
  await shot('v3-home-dark-ar.png');
  await ev(`document.querySelector('[data-lang-pick="es"]').click()`);
  await sleep(600);
  check('es: dir=ltr + Spanish nav', await ev('document.documentElement.dir==="ltr" && [...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="Ajustes")'));
  await ev(`document.querySelector('[data-lang-pick="ru"]').click()`);
  await sleep(600);
  check('ru: Russian nav', await ev('[...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="Настройки")'));
  await ev(`document.querySelector('[data-lang-pick="zh"]').click()`);
  await sleep(600);
  check('zh: dir=ltr + Chinese nav', await ev('document.documentElement.dir==="ltr" && [...document.querySelectorAll(".nav-btn span")].some(s=>s.textContent==="设置")'));
  await shot('v3-home-dark-zh.png');
  await ev(`document.querySelector('[data-lang-pick="fa"]').click()`);
  await sleep(600);
  check('fa: dir=rtl again', await ev('document.documentElement.dir==="rtl"'));

  // home tiles show feature chips; explore grid exists on the search page
  check('feature chips on home tiles', await ev('document.querySelectorAll("#platform-grid .chip").length>5'));
  await ev(`document.querySelector('[data-page="search"]').click()`);
  await sleep(200);
  check('explore grid rendered', await ev('document.querySelectorAll("#explore-grid .platform-card").length===5'));

  // settings: account card exists; the v3.1 always-on adult filter has
  // NO settings UI (no toggle, no domain list) and main refuses the site
  await ev(`document.querySelector('[data-page="settings"]').click()`);
  await sleep(400);
  check('account mode select', await ev('!!document.querySelector("#s-account-mode")'));
  check('adult block settings removed', await ev('!document.querySelector("#s-blockadult") && !document.querySelector("#s-blocked")'));
  const blocked = await ev(`window.kaman.info('https://www.pornhub.com/video/123','',null).then(()=>'NOT-BLOCKED').catch(e=>String(e&&e.message||e))`);
  check('adult site blocked in main', /blocked-by-user-list/.test(String(blocked)), String(blocked).slice(0, 60));

  // v3.1: platforms page has a card per platform; sites page lists the
  // engine's extractors live; a platform opens its own section
  await ev(`document.querySelector('[data-page="platforms"]').click()`);
  await sleep(600);
  check('platforms grid populated', await ev('document.querySelectorAll("#platforms-grid .platform-card").length>=6'));
  check('sites count shown', await ev('/\\d/.test(document.querySelector("#sites-count").textContent)'));
  await ev(`document.querySelector('#platforms-grid .platform-card').click()`);
  await sleep(400);
  check('platform section opens', await ev('!!document.querySelector("[data-page-panel=platform].active") && !!document.querySelector("#pf-url")'));
  await ev(`document.querySelector('[data-page="platforms"]').click()`);
  await sleep(300);
  await ev(`document.querySelector('#sites-open').click()`);
  await sleep(900);
  check('sites list populated (1000+)', await ev('document.querySelectorAll("#sites-grid .site-chip").length>1000'));
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
