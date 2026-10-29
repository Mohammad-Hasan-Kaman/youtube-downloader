'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kaman', {
  // i18n
  langGet: () => ipcRenderer.invoke('lang:get'),
  langSet: (l) => ipcRenderer.invoke('lang:set', l),
  onLang: (cb) => ipcRenderer.on('lang:updated', (_e, s) => cb(s)),

  // tunnel / network
  tunnelGet: () => ipcRenderer.invoke('tunnel:get'),
  tunnelRecheck: () => ipcRenderer.invoke('tunnel:recheck'),
  onTunnelStatus: (cb) => ipcRenderer.on('tunnel:status', (_e, s) => cb(s)),
  onTunnelLog: (cb) => ipcRenderer.on('tunnel:log', (_e, m) => cb(m)),

  // yt-dlp
  search: (q, proxy) => ipcRenderer.invoke('yt:search', q, proxy),
  info: (url, proxy) => ipcRenderer.invoke('yt:info', url, proxy),
  playlist: (url, proxy) => ipcRenderer.invoke('yt:playlist', url, proxy),
  download: (job, proxy) => ipcRenderer.invoke('yt:download', job, proxy),
  cancel: (id) => ipcRenderer.invoke('yt:cancel', id),
  onYtEvent: (cb) => ipcRenderer.on('yt:event', (_e, e) => cb(e)),

  // paths
  getDownloads: () => ipcRenderer.invoke('paths:downloads'),
  pickDir: () => ipcRenderer.invoke('paths:pick'),
  openFolder: (p) => ipcRenderer.invoke('paths:open', p),

  // settings
  settingGet: (k) => ipcRenderer.invoke('settings:get', k),
  settingSet: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  resetConfig: () => ipcRenderer.invoke('settings:reset'),
  themeSet: (t) => ipcRenderer.invoke('theme:set', t),
  tunnelModeGet: () => ipcRenderer.invoke('tunnelMode:get'),
  tunnelModeSet: (m) => ipcRenderer.invoke('tunnelMode:set', m),
});
