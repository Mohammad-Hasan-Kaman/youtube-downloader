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

  tunnel.on('status', (s) => win && win.webContents.send('tunnel:status', s));
  tunnel.on('log', (msg) => win && win.webContents.send('tunnel:log', msg));

  yt.on('event', (e) => win && win.webContents.send('yt:event', e));

  createWindow(isDev);
  // Warm up connection in background once the UI is up
  setTimeout(() => { tunnel.ensure().catch(() => {}); }, 800);
});

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

// Language
ipcMain.handle('lang:get', () => ({
  language: state.get('language', 'fa'),
  strings: getI18n(state.get('language', 'fa')),
}));
ipcMain.handle('lang:set', (_e, lang) => {
  state.set('language', lang);
  if (win) win.webContents.send('lang:updated', getI18n(lang));
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
ipcMain.handle('yt:search', async (_e, q, proxy) => yt.search(q, proxy));
ipcMain.handle('yt:info', async (_e, url, proxy) => yt.info(url, proxy));
ipcMain.handle('yt:playlist', async (_e, url, proxy) => yt.playlist(url, proxy));
ipcMain.handle('yt:download', async (_e, job, proxy) => yt.download(job, proxy));
ipcMain.handle('yt:cancel', (_e, id) => yt.cancel(id));

// Paths
ipcMain.handle('paths:downloads', async () => {
  const saved = state.get('downloadDir');
  if (saved && fs.existsSync(saved)) return saved;
  return app.getPath('videos');
});
ipcMain.handle('paths:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

app.on('window-all-closed', () => {
  if (tunnel) tunnel.stop();
  app.quit();
});
