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
  info: (url, proxy, opts) => ipcRenderer.invoke('yt:info', url, proxy, opts),
  playlist: (url, proxy, opts) => ipcRenderer.invoke('yt:playlist', url, proxy, opts),
  extractors: () => ipcRenderer.invoke('yt:extractors'),
  download: (job, proxy) => ipcRenderer.invoke('yt:download', job, proxy),
  cancel: (id) => ipcRenderer.invoke('yt:cancel', id),
  onYtEvent: (cb) => ipcRenderer.on('yt:event', (_e, e) => cb(e)),

  // versions / library
  versions: () => ipcRenderer.invoke('app:versions'),
  libraryList: () => ipcRenderer.invoke('library:list'),
  libraryDelete: (p) => ipcRenderer.invoke('library:delete', p),
  showInFolder: (p) => ipcRenderer.invoke('shell:show', p),

  // paths
  getDownloads: () => ipcRenderer.invoke('paths:downloads'),
  pickDir: () => ipcRenderer.invoke('paths:pick'),
  pickCookiesFile: () => ipcRenderer.invoke('paths:pickFile'),
  openFolder: (p) => ipcRenderer.invoke('paths:open', p),

  // settings
  settingGet: (k) => ipcRenderer.invoke('settings:get', k),
  settingSet: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  resetConfig: () => ipcRenderer.invoke('settings:reset'),
  themeGet: () => ipcRenderer.invoke('theme:get'),
  themeSet: (t) => ipcRenderer.invoke('theme:set', t),
  tunnelModeGet: () => ipcRenderer.invoke('tunnelMode:get'),
  tunnelModeSet: (m) => ipcRenderer.invoke('tunnelMode:set', m),
});
