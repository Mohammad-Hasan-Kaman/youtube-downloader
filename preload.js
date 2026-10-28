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
});
