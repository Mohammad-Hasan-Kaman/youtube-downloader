'use strict';
/**
 * KamanTube - main process
 * Electron app: window + IPC wiring between renderer and the
 * tunnel (Aether) and yt-dlp services.
 */
const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const TunnelManager = require('./src/tunnel');
const { YtdlpService } = require('./src/yt');
const { getI18n } = require('./src/i18n');
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
  tunnel = new TunnelManager(vendorDir);

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

// Language - user asked for a real full restart so every string flips RTL/LTR
ipcMain.handle('lang:get', () => ({
  language: state.get('language', 'fa'),
  strings: getI18n(state.get('language', 'fa')),
}));
ipcMain.handle('lang:set', (_e, lang) => {
  state.set('language', lang);
  if (win) {
    win.webContents.send('lang:updated', { language: lang, strings: getI18n(lang) });
    // full reload -> complete RTL/LTR flip on every element
    setTimeout(() => win.webContents.reload(), 120);
  }
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
// If the renderer didn't know the tunnel is up yet (tunnel connects in
// background), fall back to the live tunnel proxy automatically.
function withProxy(proxy) {
  if (proxy) return proxy;
  return (tunnel && tunnel.usingTunnel) ? tunnel.proxyUrl() : '';
}
ipcMain.handle('yt:search', async (_e, q, proxy) => yt.search(q, withProxy(proxy)));
ipcMain.handle('yt:info', async (_e, url, proxy) => yt.info(url, withProxy(proxy)));
ipcMain.handle('yt:playlist', async (_e, url, proxy) => yt.playlist(url, withProxy(proxy)));
ipcMain.handle('yt:download', async (_e, job, proxy) => yt.download(job, withProxy(proxy)));
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
ipcMain.handle('paths:open', async (_e, p) => {
  if (!p || typeof p !== 'string') return false;
  try {
    if (fs.existsSync(p)) { shell.openPath(p); return true; }
    const dir = path.dirname(p);
    if (fs.existsSync(dir)) { shell.openPath(dir); return true; }
  } catch (_) { /* ignore */ }
  return false;
});

app.on('window-all-closed', () => {
  if (tunnel) tunnel.stop();
  app.quit();
});
