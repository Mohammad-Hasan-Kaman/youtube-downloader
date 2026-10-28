'use strict';
/**
 * KamanTube - renderer logic
 * Views: home (search grid), video (quality cards), playlist, queue, history.
 */

const qs = (s) => document.querySelector(s);
const qsAll = (s) => [...document.querySelectorAll(s)];

let T = {};           // i18n strings
let netState = {};    // tunnel status cache
let proxy = '';       // active socks5 url ('' = direct)
let currentVideo = null;
let selectedQuality = null;
let queueItems = [];
let historyItems = [];
let running = 0;      // concurrent downloads
const MAX_CONCURRENT = 2;

/* ------------------------------------------------------------- helpers */

const fmtDur = (sec) => {
  if (!sec) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};
const fmtSize = (b) => {
  if (!b) return '';
  const units = ['KB', 'MB', 'GB'];
  let v = b / 1024, i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
};
const fmtViews = (n) => {
  if (!n) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
};
const toast = (msg, type = '') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  qs('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2800);
  setTimeout(() => el.remove(), 3300);
};
const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
};
const isVideoUrl = (t) =>
  /^https?:\/\//.test(t) && /(youtube\.com|youtu\.be)/.test(t);

/* ---------------------------------------------------------------- i18n */

function applyStrings() {
  document.title = T.appName || 'KamanTube';
  qsAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    if (T[k]) el.textContent = T[k];
  });
  const lang = document.documentElement.getAttribute('lang') || 'fa';
  qs('#search-input').placeholder = T.searchPlaceholder;
}

async function loadLang() {
  const { language, strings } = await window.kaman.langGet();
  T = strings;
  applyLangMeta(language);
  applyStrings();
}

function applyLangMeta(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  qsAll('.seg-b').forEach((b) => b.classList.toggle('active', b.dataset.lang === language));
  qs('#search-input').placeholder = T.searchPlaceholder || '';
}

/* ------------------------------------------------------------- network */

function renderNet() {
  const dot = qs('#net-dot');
  const ipEl = qs('#net-ip');
  const stateEl = qs('#net-state');
  if (!netState.state) return;
  dot.className = `net-dot ${netState.state}`;
  if (netState.state === 'offline') {
    ipEl.textContent = T.offline;
    stateEl.textContent = '';
    qs('#net-chip').title = '';
    return;
  }
  const ip = netState.ip || '—';
  const cc = netState.country || '';
  let label = T.direct;
  if (netState.usingTunnel) {
    label = netState.protocol || T.tunnel;
  }
  ipEl.textContent = ip;
  stateEl.textContent = cc ? `${cc} · ${label}` : label;
  qs('#net-chip').title = netState.exitIp && netState.usingTunnel
    ? `exit: ${netState.exitIp} (${netState.exitCountry || '?'})` : '';
}

/* --------------------------------------------------------------- views */

function show(view) {
  qsAll('.view-pane').forEach((p) => p.classList.remove('active'));
  qsAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  qs('#pane-' + view).classList.add('active');
  qs(`.nav-btn[data-view="${view}"]`).classList.add('active');
  if (view === 'queue') renderQueue();
  if (view === 'history') renderHistory();
}

/* ---------------------------------------------------------------- home */

async function doSearch() {
  const q = qs('#search-input').value.trim();
  if (!q) return;
  qs('#home-empty').hidden = true;
  const grid = qs('#grid-results');
  grid.innerHTML = '';

  if (isVideoUrl(q)) {
    const skel = skeleton(1);
    let r;
    try {
      r = await window.kaman.info(q, proxy);
    } catch (e) {
      try { r = await window.kaman.playlist(q, proxy); } catch (_) { r = null; }
    }
    skel.remove();
    if (!r) { qs('#home-empty').textContent = T.errorSearch; qs('#home-empty').hidden = false; return; }
    if (r.type === 'video') { renderVideo(r); return; }
    renderPlaylist(r); return;
  }

  const skel = skeleton(8);
  let items = [];
  try {
    items = await window.kaman.search(q, proxy);
  } catch (e) { /* keep empty */ }
  skel.remove();
  if (!items.length) {
    qs('#home-empty').textContent = T.notFound;
    qs('#home-empty').hidden = false;
    return;
  }
  grid.innerHTML = items.map(cardHtml).join('');
  grid.querySelectorAll('.grid-item').forEach((el, i) => {
    el.onclick = () => playResult(items[i]);
  });
}

function skeleton(n) {
  const skel = document.createElement('div');
  skel.id = 'home-skel';
  skel.innerHTML = Array.from({ length: n }, () =>
    `<div class="skel-card skel"><div class="sk-thumb"></div><div class="sk-line" style="width:80%"></div><div class="sk-line" style="width:55%"></div></div>`
  ).join('');
  qs('#pane-home').appendChild(skel);
  return skel;
}

function cardHtml(v) {
  return `
    <div class="grid-item">
      <div class="gi-thumb">
        ${v.thumb ? `<img src="${v.thumb}" loading="lazy" onerror="this.remove()">` : ''}
        <div class="gi-dur">${fmtDur(v.duration)}</div>
      </div>
      <div class="gi-body">
        <div class="gi-title">${esc(v.title)}</div>
        <div class="gi-channel">${esc(v.uploader)}</div>
        <div class="gi-meta">${fmtViews(v.views) || ''}</div>
      </div>
    </div>`;
}

async function playResult(v) {
  const skel = skeleton(4);
  let r = null;
  try { r = await window.kaman.info(v.url, proxy); } catch (_) { /* try playlist */ }
  if (!r) { try { r = await window.kaman.playlist(v.url, proxy); } catch (_) { } }
  skel.remove();
  if (!r) { toast(T.errorSearch, 'err'); return; }
  if (r.type === 'video') renderVideo(r); else renderPlaylist(r);
}

/* --------------------------------------------------------------- video */

function renderVideo(v) {
  currentVideo = v;
  selectedQuality = null;
  qs('#v-thumb').src = v.thumb || '';
  qs('#v-duration').textContent = fmtDur(v.duration);
  qs('#v-title').textContent = v.title;
  qs('#v-channel').textContent = v.uploader;
  qs('#v-views').textContent = v.views ? `${T.viewsLabel}: ${fmtViews(v.views)}` : '';
  qs('#v-date').textContent = v.uploadDate
    ? `${v.uploadDate.slice(0, 4)}-${v.uploadDate.slice(4, 6)}-${v.uploadDate.slice(6, 8)}` : '';
  qs('#v-subs').value = '';
  qs('#v-thumbdl').checked = false;

  const grid = qs('#q-grid');
  grid.innerHTML = (v.qualities || []).map((q, i) => `
    <div class="q-card ${i === 0 ? 'sel' : ''}" data-fid="${q.formatId}">
      ${i === 0 ? '<div class="q-badge">BEST</div>' : ''}
      ${q.hdr ? '<div class="q-badge" style="inset-inline-start:6px;color:#fff">HDR</div>' : ''}
      <div class="q-h">${q.height}p</div>
      <div class="q-sub">${q.fps}fps ${q.size ? '· ' + fmtSize(q.size) : ''}</div>
    </div>`).join('');
  selectedQuality = v.qualities?.[0]?.formatId || null;
  grid.querySelectorAll('.q-card').forEach((el) => {
    el.onclick = () => {
      grid.querySelectorAll('.q-card').forEach((x) => x.classList.remove('sel'));
      el.classList.add('sel');
      selectedQuality = el.dataset.fid;
    };
  });
  qs('#q-hint').textContent = v.audio ? `${T.audio}: ${v.audio.abr}kbps · ${fmtSize(v.audio.size)}` : '';
  qs('#btn-audio').disabled = !v.audio;
  show('video');
  qs('#view-body').scrollTop = 0;
}

function enqueue(kind) {
  if (!currentVideo) return;
  const url = currentVideo.url;
  const title = currentVideo.title;
  const job = {
    id: 'u' + Date.now() + Math.random().toString(36).slice(2, 5),
    url, title,
    kind,
    formatId: kind === 'audio' ? null : selectedQuality,
    subLang: kind === 'video' ? (qs('#v-subs').value || null) : null,
    thumbnail: kind === 'video' ? qs('#v-thumbdl').checked : false,
    state: 'wait', pct: 0, speed: '', outDir: lastDir,
  };
  queueItems.unshift(job);
  updateQueueBadge();
  show('queue');
  pumpQueue();
  toast(T.toQueue, 'ok');
}

/* ------------------------------------------------------------ playlist */

let currentPlaylist = null;
function renderPlaylist(pl) {
  currentPlaylist = pl;
  qs('#pl-thumb').src = pl.entries?.[0]?.thumb || '';
  qs('#pl-title').textContent = pl.title || T.playlistItems;
  qs('#pl-count').textContent = `${pl.entries?.length || 0} ${T.items}`;
  qs('#pl-items').innerHTML = pl.entries.map((e) => `
    <div class="pl-row">
      <input type="checkbox" class="pl-check" data-id="${e.id}" checked />
      <img src="${e.thumb}" loading="lazy" onerror="this.src=''">
      <div class="pi-title">${esc(e.title)}</div>
      <div class="pi-dur">${fmtDur(e.duration)}</div>
    </div>`).join('');
  show('playlist');
}

function enqueuePlaylist() {
  const checks = qsAll('#pl-items .pl-check');
  const sel = currentPlaylist.entries.filter((e, i) => checks[i]?.checked);
  sel.reverse().forEach((e) => {
    queueItems.unshift({
      id: 'u' + Date.now() + Math.random().toString(36).slice(2, 5),
      url: e.url, title: e.title, kind: 'best',
      formatId: 'best', state: 'wait', pct: 0, speed: '',
      outDir: lastDir + '\\' + (currentPlaylist.title || 'Playlist').replace(/[\\/:*?"<>|]/g, '_'),
    });
  });
  updateQueueBadge();
  show('queue');
  pumpQueue();
  toast(`${sel.length} ${T.toQueue}`, 'ok');
}

/* --------------------------------------------------------------- queue */

function updateQueueBadge() {
  const pending = queueItems.filter((j) => j.state !== 'done').length;
  qs('#queue-badge').hidden = pending === 0;
  qs('#queue-badge').textContent = pending;
}

function renderQueue() {
  const box = qs('#queue-items');
  qs('#queue-empty').hidden = queueItems.length > 0;
  box.innerHTML = queueItems.map((j) => `
    <div class="queue-item" data-id="${j.id}">
      <img src="${j.thumb || ''}" onerror="this.style.display='none'">
      <div class="qi-mid">
        <div class="qi-title">${esc(j.title)}</div>
        <div class="qi-sub">${j.kind === 'audio' ? T.audio : j.kind === 'best' ? 'Best' : j.qualityLabel || ''}</div>
        <div class="qi-bar"><div class="qi-fill" style="width:${j.pct || 0}%"></div></div>
      </div>
      <div class="qi-stat">
        ${j.state === 'wait' ? `<span class="status-tag st-wait">${T.toQueue}</span>` : ''}
        ${j.state === 'down' ? `<strong>${Math.round(j.pct || 0)}%</strong><br>${fmtSize(j.speed)}/s` : ''}
        ${j.state === 'merge' ? `<span class="status-tag st-merge">${T.mergeProgress}</span>` : ''}
        ${j.state === 'done' ? `<span class="status-tag st-done">${T.done}</span>` : ''}
        ${j.state === 'error' ? `<span class="status-tag st-fail">${T.failed}</span>` : ''}
        ${j.state === 'canceled' ? `<span class="status-tag st-wait">${T.canceled}</span>` : ''}
      </div>
      ${(j.state === 'wait' || j.state === 'down' || j.state === 'merge') ? `<button class="cancel-x" data-cancel="${j.id}">✕</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('[data-cancel]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.cancel;
      const job = queueItems.find((j) => j.id === id);
      if (job && job.state === 'down') window.kaman.cancel(id);
      if (job && ['wait', 'merge'].includes(job.state)) { job.state = 'canceled'; pumpQueue(); }
      renderQueue();
    };
  });
}

async function pumpQueue() {
  while (running < MAX_CONCURRENT) {
    const job = queueItems.find((j) => j.state === 'wait');
    if (!job) break;
    startDownload(job);
  }
}

async function startDownload(job) {
  job.state = 'down';
  running++;
  updateQueueBadge();
  if (qs('#pane-queue').classList.contains('active')) renderQueue();
  try {
    await window.kaman.download(job, proxy);
  } catch (e) {
    job.state = 'error';
    running--;
    updateQueueBadge();
    renderQueue();
  }
}

const applyYtEvent = (e) => {
  const job = queueItems.find((j) => j.id === e.id);
  if (!job) return;
  if (e.type === 'progress') {
    job.state = 'down';
    job.pct = e.pct || 0;
    job.speed = e.speed || 0;
  } else if (e.type === 'merging') job.state = 'merge';
  else if (e.type === 'done') {
    job.state = 'done'; running--;
    historyItems.unshift({ title: job.title, url: job.url, when: Date.now() });
    localStorage.setItem('kt_history', JSON.stringify(historyItems.slice(0, 60)));
    toast(T.toHistory, 'ok');
    updateQueueBadge();
  } else if (e.type === 'error') {
    job.state = 'error'; running--;
    toast(`${T.failed}: ${e.message || ''}`, 'err');
    updateQueueBadge();
  } else if (e.type === 'canceled') {
    job.state = 'canceled'; running--;
    updateQueueBadge();
  }
  updateQueueBadge();
  if (qs('#pane-queue').classList.contains('active')) renderQueue();
  else scheduleUiRefresh();
};

let uiTimer = null;
const scheduleUiRefresh = () => {
  if (uiTimer) return;
  uiTimer = setTimeout(() => {
    uiTimer = null;
    if (qs('#pane-queue').classList.contains('active')) renderQueue();
  }, 800);
};

/* ------------------------------------------------------------- history */

function renderHistory() {
  const box = qs('#history-items');
  const items = historyItems.slice(0, 60);
  qs('#history-empty').hidden = items.length > 0;
  box.innerHTML = items.map((h) => `
    <div class="queue-item">
      <div class="qi-mid">
        <div class="qi-title">${esc(h.title)}</div>
        <div class="qi-sub">${new Date(h.when).toLocaleString()}</div>
      </div>
      <div class="qi-stat"><button class="mini-btn" data-open="${esc(h.url)}">${T.copyUrl}</button></div>
    </div>`).join('');
  box.querySelectorAll('[data-open]').forEach((b) => {
    b.onclick = () => navigator.clipboard.writeText(b.dataset.open) && toast(T.copyUrl, 'ok');
  });
}

/* ---------------------------------------------------------------- init */

let lastDir = '';

async function init() {
  await loadLang();

  historyItems = (() => {
    try { return JSON.parse(localStorage.getItem('kt_history') || '[]'); } catch (_) { return []; }
  })();

  lastDir = await window.kaman.getDownloads();
  qs('#dir-path').textContent = lastDir;
  qs('#dir-path').title = lastDir;

  netState = await window.kaman.tunnelGet();
  proxy = netState.usingTunnel ? `socks5h://127.0.0.1:${netState.port || 1819}` : '';
  renderNet();
  // welcome screen: no results yet -> nothing under the hero
  qs('#home-empty').hidden = true;

  window.kaman.onTunnelStatus((s) => {
    netState = s;
    renderNet();
    proxy = s.usingTunnel ? `socks5h://127.0.0.1:${s.port || 1819}` : '';
  });

  window.kaman.onYtEvent(applyYtEvent);
  window.kaman.onLang((s) => { T = s; applyStrings(); applyLangMeta(document.documentElement.lang || 'fa'); });

  // nav
  qsAll('.nav-btn[data-view]').forEach((b) => b.onclick = () => show(b.dataset.view));
  qsAll('.back-btn').forEach((b) => b.onclick = () => show(b.dataset.back));

  // search
  qs('#btn-search').onclick = doSearch;
  qs('#search-input').addEventListener('keydown', (e) => e.key === 'Enter' && doSearch());

  // video actions
  qs('#btn-addq').onclick = () => enqueue('video');
  qs('#btn-audio').onclick = () => enqueue('audio');

  // playlist
  qs('#btn-pl-all').onclick = enqueuePlaylist;

  // queue management
  qs('#btn-clear-q').onclick = () => {
    queueItems = queueItems.filter((j) => j.state === 'down' || j.state === 'merge');
    updateQueueBadge();
    renderQueue();
  };

  // settings
  qs('#btn-dir').onclick = async () => {
    const d = await window.kaman.pickDir();
    if (d) { lastDir = d; qs('#dir-path').textContent = d; }
  };

  // language
  qsAll('.seg-b').forEach((b) => b.onclick = async () => {
    await window.kaman.langSet(b.dataset.lang);
  });

  // focus search
  qs('#search-input').focus();
}

document.addEventListener('DOMContentLoaded', init);
