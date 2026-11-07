'use strict';
/**
 * KamanTube - main process
 * Electron app: window + IPC wiring between renderer and the
 * tunnel (Aether) and yt-dlp services.
 */
const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const { SmartRoutingManager } = require('./src/routing');
const { YtdlpService } = require('./src/yt');
const { getI18n, isRtl } = require('./src/i18n');
const providers = require('./src/providers');
const state = require('./src/state');

let win = null;
let tunnel = null;
let yt = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  const isDev = !!process.env.KAMANTUBE_DEV;
  const resourcesDir = process.resourcesPath || path.join(__dirname, 'vendor');
  const vendorDir = isDev
    ? path.join(__dirname, 'vendor')
    : path.join(resourcesDir, 'vendor');

  yt = new YtdlpService(vendorDir);
  tunnel = new SmartRoutingManager(vendorDir);

  tunnel.on('status', (s) => {
    if (win) win.webContents.send('tunnel:status', s);
    applySessionProxy();
  });
  tunnel.on('log', (msg) => win && win.webContents.send('tunnel:log', msg));

  yt.on('event', (e) => win && win.webContents.send('yt:event', e));

  createWindow(isDev);
  // Warm up connection in background once the UI is up
  setTimeout(() => { tunnel.ensure().catch(() => {}); }, 800);

  // Watchdog: if the tunnel dies mid-download, reconnect automatically.
  setInterval(() => watchTunnel(), 15000);
  // Reconnect loop: if the tunnel is needed but down, keep trying (no lock).
  setInterval(() => { tryTunnelAgain(); }, 30000);
});

let tunnelCheckBusy = false;
async function watchTunnel() {
  if (!tunnel || !tunnel.usingTunnel || !tunnel.port) return;
  if (tunnel.ensureRunning || tunnelCheckBusy) return;
  tunnelCheckBusy = true;
  try {
    const ok = await tunnel.verifyProxy(tunnel.proxyUrl(), 12000);
    if (!ok) {
      tunnel.emit('log', 'Tunnel health check failed - reconnecting...');
      tunnel.stop();
      await tunnel.ensure().catch(() => {});
    }
  } catch (_) { /* keep going */ } finally {
    tunnelCheckBusy = false;
  }
}

let retryBusy = false;
async function tryTunnelAgain() {
  if (!tunnel || !win) return;
  if (retryBusy || tunnel.ensureRunning) return;
  // only when the network actually needs the tunnel but it is down
  if (tunnel.isActive && !tunnel.usingTunnel) {
    const mode = state.get('tunnelMode', 'auto');
    const needed = mode === 'forced'
      || (tunnel.lastCountry && ['IR'].includes(tunnel.lastCountry));
    if (needed) {
      retryBusy = true;
      try { await tunnel.ensure().catch(() => {}); } finally { retryBusy = false; }
    }
  }
}

/** Route the renderer's own web traffic (thumbnails etc.) through the tunnel when it is up. */
function applySessionProxy() {
  if (!win) return;
  const rules = tunnel && tunnel.usingTunnel
    ? `socks5://127.0.0.1:${tunnel.port}`
    : '';
  win.webContents.session.setProxy({
    mode: rules ? 'fixed_servers' : 'direct',
    proxyRules: rules,
    proxyBypassRules: '<local>',
  }).catch(() => {});
}

function createWindow(isDev) {
  const i18n = getI18n(state.get('language'));

  win = new BrowserWindow({
    width: 1250,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'KamanTube',
    icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')),
    backgroundColor: '#0b0e17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // surface renderer console errors in the main-process stderr (dev runs)
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 2) console.error('[renderer]', source && source.split(/[\\/]/).pop(), line, message);
  });
  win.webContents.on('preload-error', (_e, path_, err) => {
    console.error('[preload-error]', path_, err && err.message);
  });
  process.on('uncaughtException', (err) => console.error('[main]', err && err.stack || err));

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

/* ------------------------------------------------------------------ IPC --- */

// Language - applied live by the renderer (strings + dir flip), no reload.
ipcMain.handle('lang:get', () => ({
  language: state.get('language', 'fa'),
  strings: getI18n(state.get('language', 'fa')),
  rtl: isRtl(state.get('language', 'fa')),
}));
ipcMain.handle('lang:set', (_e, lang) => {
  state.set('language', lang);
  const payload = { language: lang, strings: getI18n(lang), rtl: isRtl(lang) };
  if (win) win.webContents.send('lang:updated', payload);
  return payload;
});

// Settings
ipcMain.handle('settings:get', (_e, key) => state.get(key, null));
ipcMain.handle('settings:set', (_e, key, value) => { state.set(key, value); return true; });
ipcMain.handle('settings:reset', () => {
  state.reset();
  if (tunnel) tunnel.stop();
  return true;
});

// Theme / tunnel mode
ipcMain.handle('theme:get', () => state.get('theme', 'dark'));
ipcMain.handle('theme:set', (_e, theme) => { state.set('theme', theme); return true; });
ipcMain.handle('tunnelMode:get', () => state.get('tunnelMode', 'auto'));
ipcMain.handle('tunnelMode:set', (_e, mode) => {
  state.set('tunnelMode', mode);
  if (tunnel) {
    if (mode === 'direct') tunnel.stop();
    else tunnel.ensure().catch(() => {});
  }
  return true;
});

// Tunnel / network info
ipcMain.handle('tunnel:get', async () => ({
  ip: tunnel.lastIp,
  country: tunnel.lastCountry,
  canTunnel: tunnel.tunnelNeeded,
  active: tunnel.isActive,
  usingTunnel: tunnel.usingTunnel,
  protocol: tunnel.protocolLabel,
}));
ipcMain.handle('tunnel:recheck', async () => { await tunnel.ensure(); return null; });

// yt-dlp operations
// Per-site routing (mission section 7.3): the best route depends on the
// destination, not just the country. YouTube from Iran needs the tunnel
// (direct hits a bot wall), while TikTok geo-blocks the tunnel exit
// (HTTP 451) and works direct. Extraction calls therefore try the
// preferred route first and fall back to the other route on failure.
// 'direct' as proxy is an explicit renderer request for a direct route.
function withProxy(proxy) {
  if (proxy === 'direct') return '';
  if (proxy) return proxy;
  return (tunnel && tunnel.usingTunnel) ? tunnel.proxyUrl() : '';
}
function routeOrder() {
  const t = (tunnel && tunnel.usingTunnel) ? tunnel.proxyUrl() : '';
  return t ? [t, ''] : [''];
}
async function withRouteFallback(fn) {
  let lastErr = null;
  for (const p of routeOrder()) {
    try { return await fn(p); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('request failed');
}
// Site blocking: the built-in adult list is always on and cannot be
// configured by the user (v3.1 product decision). Enforced here so no
// code path in the renderer can bypass it.
function assertNotBlocked(url) {
  if (providers.isBlocked(url)) {
    throw new Error('blocked-by-user-list');
  }
}
ipcMain.handle('yt:search', async (_e, q, proxy) => {
  if (proxy) return yt.search(q, withProxy(proxy));
  return withRouteFallback((p) => yt.search(q, p));
});
ipcMain.handle('yt:info', async (_e, url, proxy, opts) => {
  assertNotBlocked(url);
  if (proxy) return yt.info(url, withProxy(proxy), opts || null);
  return withRouteFallback((p) => yt.info(url, p, opts || null));
});
ipcMain.handle('yt:playlist', async (_e, url, proxy, opts) => {
  assertNotBlocked(url);
  if (proxy) return yt.playlist(url, withProxy(proxy), opts || null);
  return withRouteFallback((p) => yt.playlist(url, p, opts || null));
});
ipcMain.handle('yt:download', async (_e, job, proxy) => {
  assertNotBlocked(job && job.url);
  // Route is decided HERE, at spawn time, from the tunnel's live state -
  // not from the renderer's snapshot, which is '' until the first tunnel
  // status event and stale after any reconnect. When the renderer did not
  // pin a route, wait for the tunnel attempt to settle first: a download
  // spawned on the wrong route hangs in extraction at 0% with no fallback.
  if (!proxy && tunnel) {
    try { await tunnel.ensure(); } catch (_) { /* proceed on current route */ }
  }
  return yt.download(job, withProxy(proxy));
});
ipcMain.handle('yt:cancel', (_e, id) => yt.cancel(id));

// Paths
ipcMain.handle('paths:downloads', async () => {
  const saved = state.get('downloadDir');
  if (saved && fs.existsSync(saved)) return saved;
  return app.getPath('videos');
});
ipcMain.handle('paths:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled) return null;
  const d = r.filePaths[0];
  state.set('downloadDir', d);
  return d;
});
ipcMain.handle('paths:pickFile', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Cookies', extensions: ['txt'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (r.canceled) return null;
  return r.filePaths[0];
});
ipcMain.handle('paths:open', async (_e, p) => {
  if (!p || typeof p !== 'string') return false;
  try {
    if (fs.existsSync(p)) { shell.openPath(p); return true; }
    const dir = path.dirname(p);
    if (fs.existsSync(dir)) { shell.openPath(dir); return true; }
  } catch (_) { /* ignore */ }
  return false;
});

// Versions / dependency health (Diagnostics + Settings)
ipcMain.handle('app:versions', async () => {
  const aetherExe = path.join(
    process.env.KAMANTUBE_DEV ? path.join(__dirname, 'vendor') : path.join(process.resourcesPath || '', 'vendor'),
    'aether', 'aether.exe');
  return {
    app: app.getVersion(),
    electron: process.versions.electron,
    ytDlp: yt ? await yt.version() : null,
    ffmpeg: yt ? yt.hasFfmpeg() : false,
    aether: fs.existsSync(aetherExe),
  };
});

// Media library: real files inside the downloads folder (one level deep).
const MEDIA_EXTS = {
  video: ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'],
  audio: ['.mp3', '.m4a', '.opus', '.ogg', '.wav', '.flac'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
};
function mediaKind(ext) {
  for (const [k, list] of Object.entries(MEDIA_EXTS)) if (list.includes(ext)) return k;
  return null;
}
ipcMain.handle('library:list', async () => {
  const dir = state.get('downloadDir') && fs.existsSync(state.get('downloadDir'))
    ? state.get('downloadDir') : app.getPath('videos');
  const out = [];
  const walk = (d, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 1) walk(full, depth + 1); continue; }
      if (e.name.endsWith('.part') || e.name.endsWith('.ytdl')) continue;
      const kind = mediaKind(path.extname(e.name).toLowerCase());
      if (!kind) continue;
      try {
        const st = fs.statSync(full);
        out.push({ name: e.name, path: full, kind, size: st.size, mtime: st.mtimeMs });
      } catch (_) { /* ignore */ }
    }
  };
  walk(dir, 0);
  out.sort((a, b) => b.mtime - a.mtime);
  return { dir, files: out };
});
ipcMain.handle('library:delete', async (_e, p) => {
  if (!p || typeof p !== 'string') return false;
  const dir = state.get('downloadDir') || app.getPath('videos');
  const resolved = path.resolve(p);
  // only ever delete inside the downloads folder tree
  if (!resolved.startsWith(path.resolve(dir))) return false;
  try { fs.rmSync(resolved, { force: true }); return true; } catch (_) { return false; }
});
ipcMain.handle('shell:show', async (_e, p) => {
  if (!p || typeof p !== 'string' || !fs.existsSync(p)) return false;
  shell.showItemInFolder(p);
  return true;
});

app.on('window-all-closed', () => {
  if (tunnel) tunnel.stop();
  app.quit();
});
