'use strict';
/**
 * KamanTube v3 - renderer.
 * Pages: home, search, new, playlists, queue, history, library,
 * settings, diagnostics, about. All network work goes through the
 * main process (window.kaman); this file owns UI state only.
 * Queue updates are targeted DOM writes keyed by job id - the list
 * is never rebuilt on a progress event (no flicker).
 */

const qs = (s, r) => (r || document).querySelector(s);
const qsAll = (s, r) => [...(r || document).querySelectorAll(s)];
const K = window.kaman;
const P = window.KamanProviders;

/* ------------------------------------------------------------ icons --- */
const IC = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  playlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M4 10h12M4 14h7"/><path d="m15 14 6 3.5-6 3.5z"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10m0 0 4-4m-4 4L8 9"/><path d="M4 17v3h16v-3"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 3"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95A7 7 0 0 0 14.1 5.1L13.72 2.6h-3.44L9.9 5.1a7 7 0 0 0-2.4 1.44l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.4 1.44l.38 2.5h3.44l.38-2.5a7 7 0 0 0 2.4-1.44l2.36.95 2-3.46-2-1.55c.1-.45.14-.92.14-1.4z"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 5 12L17 12h4"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 4.5v15l13-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4"/><path d="M4 20h16"/></svg>',
};
function icon(name) { return IC[name] || ''; }
qsAll('[data-ico]').forEach((el) => { el.innerHTML = icon(el.dataset.ico); });

/* ------------------------------------------------------------ state --- */
let T = {};
let LANG = 'fa';
let page = 'home';
let proxy = '';
let net = { state: 'checking', ip: null, country: null, usingTunnel: false, protocol: null };
let downloadsDir = '';
const cfg = {
  theme: 'system', defaultQuality: 'best', concurrency: 2, rateLimitKb: 0,
  subsMode: 'embedded', thumbMode: 'embedded', defaultSubLang: '',
  accountMode: 'off', accountBrowser: 'chrome', cookiesFile: '',
  blockAdult: true, blockedExtra: '',
};
let RTL = true;
const PLATFORM_COLORS = { youtube: '#e62117', pinterest: '#c8232c', instagram: '#b83a7d', tiktok: '#3aa6a0', x: '#888', web: '#c8871a' };
const NAV_KEYS = { home: 'navHome', search: 'navSearch', new: 'navNew', playlists: 'navPlaylists', queue: 'navQueue', history: 'navHistory', library: 'navLibrary', settings: 'navSettings', diagnostics: 'navDiagnostics', about: 'navAbout' };

const fmtBytes = (kb) => {
  if (!kb || kb <= 0) return '';
  const mb = kb / 1024;
  return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb >= 1 ? mb.toFixed(1) + ' MB' : Math.round(kb) + ' KB';
};
const fmtDur = (s) => {
  if (!s) return '';
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
};
const fmtViews = (n) => {
  if (!n) return '';
  const loc = { fa: 'fa-IR', zh: 'zh-CN' }[LANG] || LANG;
  try { return new Intl.NumberFormat(loc, { notation: 'compact' }).format(n); }
  catch (_) { return String(n); }
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, isErr) {
  const box = qs('#toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* -------------------------------------------------------- i18n -------- */
function applyStrings() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = RTL ? 'rtl' : 'ltr';
  qsAll('[data-i18n]').forEach((el) => { const v = T[el.dataset.i18n]; if (v) el.textContent = v; });
  qsAll('[data-i18n-title]').forEach((el) => { const v = T[el.dataset.i18nTitle]; if (v) el.title = v; });
  qs('#page-title').textContent = T[NAV_KEYS[page]] || '';
  qs('#home-url').placeholder = T.pastePlaceholder || '';
  qs('#new-url').placeholder = T.pastePlaceholder || '';
  qs('#pl-url').placeholder = T.playlistPlaceholder || '';
  qs('#search-input').placeholder = T.searchPlaceholder || '';
  qs('#lib-search').placeholder = T.librarySearchPlaceholder || '';
  qsAll('#lang-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.langPick === LANG));
  const sel = qs('#s-lang'); if (sel) sel.value = LANG;
  renderPlatformGrid();
  renderExploreGrid();
  renderNetChip();
  renderQueue();
  renderHistory();
  updateOverall();
}

/* -------------------------------------------------------- theme ------- */
function effectiveTheme() {
  if (cfg.theme === 'dark' || cfg.theme === 'light') return cfg.theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
  qsAll('#theme-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.themePick === cfg.theme));
  const sel = qs('#s-theme'); if (sel) sel.value = cfg.theme;
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (cfg.theme === 'system') applyTheme(); });
async function setTheme(v) {
  cfg.theme = v;
  applyTheme();
  await K.themeSet(v);
}

/* -------------------------------------------------------- router ------ */
function go(p) {
  page = p;
  qsAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === p));
  qsAll('[data-page-panel]').forEach((s) => s.classList.toggle('active', s.dataset.pagePanel === p));
  qs('#page-title').textContent = T[NAV_KEYS[p]] || '';
  qs('#pages').scrollTop = 0;
  if (p === 'library') loadLibrary();
  if (p === 'diagnostics') refreshDiagnostics();
  if (p === 'home') renderHomeRecent();
}
qsAll('.nav-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));

/* -------------------------------------------------------- network ----- */
function routeLabel() {
  if (net.state === 'tunnel') return T.routeTunnel;
  if (net.state === 'direct') return T.routeDirect;
  if (net.state === 'offline') return T.routeOffline;
  return T.routeChecking;
}
function renderNetChip() {
  const dot = qs('#net-dot');
  dot.className = 'net-dot ' + (net.state === 'tunnel' ? 'tunnel' : net.state === 'direct' ? 'direct' : net.state === 'offline' ? 'offline' : '');
  qs('#net-ip').textContent = net.ip ? `${T.yourIp}: ${net.ip}${net.country ? ' · ' + net.country : ''}` : (T.checkingNet || '…');
  qs('#net-state').textContent = routeLabel() + (net.protocol ? ' · ' + net.protocol : '');
  qs('#d-ip').textContent = net.ip || T.unknown || '…';
  qs('#d-country').textContent = net.country || T.unknown || '…';
  qs('#d-route').textContent = routeLabel();
  qs('#d-protocol').textContent = net.protocol || '—';
}
K.onTunnelStatus((s) => {
  net = { ...net, ...s };
  proxy = s && s.usingTunnel && s.port ? `socks5h://127.0.0.1:${s.port}` : '';
  renderNetChip();
});
const logLines = [];
K.onTunnelLog((m) => {
  logLines.push(String(m));
  if (logLines.length > 120) logLines.splice(0, logLines.length - 120);
  const pre = qs('#d-log');
  if (pre && page === 'diagnostics') { pre.textContent = logLines.join('\n'); pre.scrollTop = pre.scrollHeight; }
});
async function refreshDiagnostics() {
  try {
    const s = await K.tunnelGet();
    if (s) {
      net = {
        ...net, ip: s.ip, country: s.country, protocol: s.protocol,
        usingTunnel: s.usingTunnel,
        state: s.usingTunnel ? 'tunnel' : (s.active ? 'direct' : net.state),
      };
      renderNetChip();
    }
  } catch (_) { /* tunnel still starting */ }
  const pre = qs('#d-log');
  if (pre) pre.textContent = logLines.join('\n');
}
qs('#d-recheck').addEventListener('click', async () => {
  const b = qs('#d-recheck');
  b.disabled = true; b.textContent = T.rechecking || '…';
  try { await K.tunnelRecheck(); } catch (_) { /* reported via status */ }
  await refreshDiagnostics();
  b.disabled = false; b.textContent = T.recheck || '';
});

/* ------------------------------------------------- download queue ----- */
/**
 * A job: { id, url, title, platform, thumb, kind, formatId, formatLabel,
 * subLang, subsMode, thumbMode, outDir, playlistId,
 * status, pct, downloadedKb, totalKb, speedKb, eta, error }
 * status: queued | downloading | merging | paused | done | failed | canceled
 */
const jobs = new Map();
let jobSeq = 0;
const history = [];

async function persistQueue() {
  const snap = [...jobs.values()]
    .filter((j) => ['queued', 'paused'].includes(j.status))
    .map((j) => ({ ...j, status: j.status === 'queued' ? 'queued' : 'paused', pct: 0, speedKb: 0, eta: '' }));
  try { await K.settingSet('queueV3', snap); } catch (_) { /* non-fatal */ }
}
async function persistHistory() {
  try { await K.settingSet('historyV3', history.slice(0, 200)); } catch (_) { /* non-fatal */ }
}

/**
 * Account access (Settings -> Account): the app never asks for or
 * stores a password. It either reads the signed-in session from the
 * user's own browser, or the user's own cookies.txt file - only with
 * the explicit mode they chose, never by default.
 */
function accountOpts() {
  if (cfg.accountMode === 'browser' && cfg.accountBrowser) return { cookiesBrowser: cfg.accountBrowser };
  if (cfg.accountMode === 'file' && cfg.cookiesFile) return { cookiesFile: cfg.cookiesFile };
  return null;
}
function jobOptions(input) {
  const base = {
    subsMode: cfg.subsMode, thumbMode: cfg.thumbMode,
    rateLimitKb: cfg.rateLimitKb || 0,
  };
  if (!input || input.useAccount !== false) Object.assign(base, accountOpts() || {});
  return base;
}
/** Instant client-side mirror of the main-process site block. */
function urlBlocked(url) {
  return P.isBlocked(url, { adult: cfg.blockAdult !== false, extra: cfg.blockedExtra || '' });
}

function enqueue(input) {
  const url = String(input.url || '').trim();
  if (!url) return null;
  if (urlBlocked(url)) { toast(T.blockedMsg, true); return null; }
  const formatId = input.formatId || 'best';
  for (const j of jobs.values()) {
    if (j.url === url && j.formatId === formatId && ['queued', 'downloading', 'merging', 'paused'].includes(j.status)) {
      toast(T.addedToQueue); // already there - do not duplicate
      go('queue');
      return j;
    }
  }
  const job = {
    id: 'j' + Date.now().toString(36) + (++jobSeq).toString(36),
    url, title: input.title || url,
    platform: input.platform || P.detect(url) || 'web',
    thumb: input.thumb || '', kind: input.kind || 'video',
    formatId, formatLabel: input.formatLabel || '',
    subLang: input.subLang || '', outDir: downloadsDir,
    playlistId: input.playlistId || null,
    status: 'queued', pct: 0, downloadedKb: 0, totalKb: 0, speedKb: 0, eta: '', error: '',
    ...jobOptions(input),
    ...(input.subsMode ? { subsMode: input.subsMode } : {}),
    ...(input.thumbMode ? { thumbMode: input.thumbMode } : {}),
  };
  jobs.set(job.id, job);
  renderQueueItem(job);
  updateQueueChrome();
  persistQueue();
  pump();
  return job;
}

function activeCount() {
  let n = 0;
  for (const j of jobs.values()) if (j.status === 'downloading' || j.status === 'merging') n++;
  return n;
}

async function pump() {
  let n = activeCount();
  for (const j of jobs.values()) {
    if (n >= Math.max(1, cfg.concurrency || 2)) break;
    if (j.status !== 'queued') continue;
    j.status = 'downloading';
    paintJob(j);
    n++;
    j.usedProxy = j.forceDirect ? '' : proxy;
    try {
      const realId = await K.download({
        id: j.id, url: j.url, title: j.title, kind: j.kind,
        formatId: j.formatId === 'best' ? 'best' : j.formatId,
        subLang: j.subLang || undefined,
        subsMode: j.subsMode, thumbMode: j.thumbMode,
        rateLimitKb: j.rateLimitKb || 0,
        cookiesBrowser: j.cookiesBrowser || undefined,
        cookiesFile: j.cookiesFile || undefined,
        outDir: j.outDir || downloadsDir,
      }, j.forceDirect ? 'direct' : proxy);
      if (realId && realId !== j.id) { /* engine honours our id */ }
    } catch (e) {
      j.status = 'failed';
      j.error = String(e && e.message || e).slice(0, 240);
      paintJob(j);
      pushHistory(j);
    }
  }
  updateQueueChrome();
}

function pushHistory(j) {
  history.unshift({
    title: j.title, url: j.url, platform: j.platform, thumb: j.thumb,
    status: j.status, when: Date.now(), outDir: j.outDir || downloadsDir,
  });
  persistHistory();
  renderHistory();
  renderHomeRecent();
}

K.onYtEvent((e) => {
  const j = jobs.get(e.id);
  if (!j) return;
  if (e.type === 'progress') {
    j.pct = e.pct; j.downloadedKb = e.downloaded || 0; j.totalKb = e.total || 0;
    j.speedKb = e.speed || 0; j.eta = e.eta || '';
    paintJobProgress(j);
    updateOverall();
    return;
  }
  if (e.type === 'merging') { j.status = 'merging'; paintJob(j); return; }
  if (e.type === 'done') {
    j.status = 'done'; j.pct = 100;
    paintJob(j); pushHistory(j); toast(T.downloadDone);
    persistQueue(); pump(); updateOverall();
    return;
  }
  if (e.type === 'canceled') {
    if (j.status !== 'paused') { j.status = 'canceled'; paintJob(j); }
    persistQueue(); pump(); updateOverall();
    return;
  }
  if (e.type === 'error') {
    if (j.status === 'paused') return;
    // Per-site route flip: the tunnel exit is geo-blocked by some sites
    // (TikTok answers HTTP 451). Retry the job once on the direct route.
    if (!j.routeFlipped && j.usedProxy && /451|Unavailable For Legal|not available in your (country|region)|geo/i.test(String(e.message || ''))) {
      j.routeFlipped = true;
      j.forceDirect = true;
      j.status = 'queued'; j.pct = 0; j.error = '';
      paintJob(j); persistQueue(); pump(); updateOverall();
      return;
    }
    j.status = 'failed';
    const em = String(e.message || '');
    j.error = /blocked-by-user-list/.test(em)
      ? (T.blockedMsg || em)
      : /Sign in to confirm|not a bot/i.test(em)
        ? (T.botCheckHint || em.slice(0, 240))
        : /login required|sign in|cookies/i.test(em) && cfg.accountMode === 'off'
          ? (T.loginNeededHint || em.slice(0, 240))
          : em.slice(0, 240);
    paintJob(j); pushHistory(j); toast(T.downloadFailed, true);
    persistQueue(); pump(); updateOverall();
  }
});

/* ---- queue DOM: build once per job, then targeted updates only ------ */
function statusText(j) {
  return {
    queued: T.statusQueued, downloading: T.statusDownloading, merging: T.statusMerging,
    paused: T.statusPaused, done: T.statusDone, failed: T.statusFailed, canceled: T.statusCanceled,
  }[j.status] || j.status;
}
function jobEl(j) { return qs(`[data-job-id="${j.id}"]`); }

function renderQueueItem(j) {
  const list = qs('#queue-list');
  const el = document.createElement('div');
  el.className = 'row-item';
  el.dataset.jobId = j.id;
  el.innerHTML = `
    ${j.thumb ? `<img class="row-thumb" src="${esc(j.thumb)}" alt="" loading="lazy">` : ''}
    <div class="row-main">
      <div class="row-title bidi" dir="auto" title="${esc(j.title)}">${esc(j.title)}</div>
      <div class="row-meta">
        <span class="kind-badge">${esc(T[P.getProvider(j.platform).nameKey] || j.platform)}</span>
        <span class="status" data-f="status"></span>
        <span class="mono" data-f="pct"></span>
        <span data-f="sizes"></span>
        <span data-f="speed"></span>
        <span data-f="eta"></span>
      </div>
      <div class="bar"><div class="bar-fill" data-f="fill"></div></div>
      <div class="row-meta" data-f="err" style="color:var(--err)"></div>
    </div>
    <div class="row-actions" data-f="actions"></div>`;
  list.appendChild(el);
  paintJob(j);
}

function paintJob(j) {
  const el = jobEl(j);
  if (!el) { renderQueueItem(j); return; }
  const st = qs('[data-f="status"]', el);
  st.textContent = statusText(j);
  st.className = 'status ' + j.status;
  qs('[data-f="err"]', el).textContent = j.status === 'failed' && j.error ? j.error : '';
  const act = qs('[data-f="actions"]', el);
  act.innerHTML = '';
  const mk = (ico, fn, title) => {
    const b = document.createElement('button');
    b.className = 'icon-btn'; b.innerHTML = icon(ico); if (title) b.title = title;
    b.addEventListener('click', fn);
    act.appendChild(b);
  };
  if (j.status === 'downloading' || j.status === 'merging') mk('pause', () => pauseJob(j), T.pause);
  if (j.status === 'paused' || j.status === 'failed' || j.status === 'canceled') mk('play', () => resumeJob(j), j.status === 'failed' ? T.retry : T.resume);
  if (['queued', 'downloading', 'merging', 'paused'].includes(j.status)) mk('x', () => cancelJob(j), T.cancel);
  mk('folder', () => K.openFolder(j.outDir || downloadsDir), T.openFolder);
  if (['done', 'failed', 'canceled'].includes(j.status)) mk('trash', () => removeJob(j), T.remove);
  paintJobProgress(j);
}

function paintJobProgress(j) {
  const el = jobEl(j);
  if (!el) return;
  qs('[data-f="fill"]', el).style.width = (j.pct || 0) + '%';
  qs('[data-f="pct"]', el).textContent = j.status === 'downloading' || j.status === 'merging' ? Math.floor(j.pct || 0) + '%' : '';
  qs('[data-f="sizes"]', el).textContent = j.totalKb ? `${fmtBytes(j.downloadedKb)} / ${fmtBytes(j.totalKb)}` : '';
  qs('[data-f="speed"]', el).textContent = j.speedKb ? `${fmtBytes(j.speedKb)}/s` : '';
  qs('[data-f="eta"]', el).textContent = j.eta ? `${T.eta}: ${j.eta}` : '';
}

async function pauseJob(j) {
  j.status = 'paused'; // set BEFORE cancel so the canceled event keeps it paused
  paintJob(j);
  await K.cancel(j.id);
  persistQueue(); pump(); updateOverall();
}
async function resumeJob(j) {
  j.status = 'queued'; j.error = '';
  paintJob(j); persistQueue(); pump();
}
async function cancelJob(j) {
  const was = j.status;
  j.status = 'canceled';
  paintJob(j);
  if (was === 'downloading' || was === 'merging') await K.cancel(j.id);
  persistQueue(); pump(); updateOverall();
}
function removeJob(j) {
  jobs.delete(j.id);
  const el = jobEl(j); if (el) el.remove();
  updateQueueChrome(); persistQueue(); updateOverall();
}

function renderQueue() {
  const list = qs('#queue-list');
  list.innerHTML = '';
  for (const j of jobs.values()) renderQueueItem(j);
  updateQueueChrome();
}
function updateQueueChrome() {
  const open = [...jobs.values()].filter((j) => ['queued', 'downloading', 'merging', 'paused'].includes(j.status)).length;
  const badge = qs('#queue-badge');
  badge.hidden = open === 0;
  badge.textContent = String(open);
  qs('#queue-empty').style.display = jobs.size === 0 ? '' : 'none';
  updateOverall();
}
function updateOverall() {
  const act = [...jobs.values()].filter((j) => ['downloading', 'merging', 'queued', 'done'].includes(j.status));
  const wrap = qs('#queue-overall');
  if (!act.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const pct = act.reduce((a, j) => a + (j.status === 'done' ? 100 : j.pct || 0), 0) / act.length;
  qs('#queue-overall-fill').style.width = pct + '%';
  qs('#queue-overall-pct').textContent = Math.floor(pct) + '%';
}
qs('#queue-clear').addEventListener('click', () => {
  for (const j of [...jobs.values()]) {
    if (['done', 'failed', 'canceled'].includes(j.status)) {
      jobs.delete(j.id);
      const el = jobEl(j); if (el) el.remove();
    }
  }
  updateQueueChrome(); persistQueue();
});

/* ------------------------------------------------------- history ------ */
function historyRow(h) {
  const el = document.createElement('div');
  el.className = 'row-item';
  el.innerHTML = `
    ${h.thumb ? `<img class="row-thumb" src="${esc(h.thumb)}" alt="" loading="lazy">` : ''}
    <div class="row-main">
      <div class="row-title bidi" dir="auto" title="${esc(h.title)}">${esc(h.title)}</div>
      <div class="row-meta">
        <span class="kind-badge">${esc(T[P.getProvider(h.platform || 'web').nameKey] || '')}</span>
        <span class="status ${h.status === 'done' ? 'done' : 'failed'}">${h.status === 'done' ? (T.statusDone || '') : (T.statusFailed || '')}</span>
        <span>${esc(new Date(h.when).toLocaleString(LANG === 'fa' ? 'fa-IR' : LANG))}</span>
      </div>
    </div>
    <div class="row-actions"></div>`;
  const act = qs('.row-actions', el);
  const b = document.createElement('button');
  b.className = 'icon-btn'; b.innerHTML = icon('folder'); b.title = T.openFolder || '';
  b.addEventListener('click', () => K.openFolder(h.outDir || downloadsDir));
  act.appendChild(b);
  return el;
}
function renderHistory() {
  const list = qs('#history-list');
  if (!list) return;
  list.innerHTML = '';
  for (const h of history) list.appendChild(historyRow(h));
  qs('#history-empty').style.display = history.length ? 'none' : '';
}
function renderHomeRecent() {
  const wrap = qs('#home-recent-wrap');
  const list = qs('#home-recent');
  if (!wrap || !list) return;
  wrap.hidden = history.length === 0;
  list.innerHTML = '';
  for (const h of history.slice(0, 5)) list.appendChild(historyRow(h));
}
qs('#history-clear').addEventListener('click', () => {
  history.length = 0;
  persistHistory(); renderHistory(); renderHomeRecent();
});

/* ------------------------------------------------------- preview ------ */
/**
 * Renders fetched media info into `mount`.
 * info.type 'video'    -> quality picker + subtitle & placement options
 * info.type 'playlist' -> entry checklist with per-item progress via queue
 */
function mountPreview(mount, info, sourceUrl) {
  mount.innerHTML = '';
  if (info.type === 'playlist') { mountPlaylist(mount, info, sourceUrl); return; }
  if (info.type === 'image') { mountImage(mount, info, sourceUrl); return; }
  const platform = P.detect(sourceUrl) || 'web';
  const wrap = document.createElement('div');
  wrap.className = 'preview card';
  const subOpts = ['<option value="">' + esc(T.subtitleNone) + '</option>']
    .concat((info.subtitles || []).map((s) => `<option value="${esc(s.lang)}">${esc(s.name)} (${esc(s.lang)})</option>`)).join('');
  wrap.innerHTML = `
    <div class="preview-media">${info.thumb ? `<img src="${esc(info.thumb)}" alt="">` : ''}</div>
    <div class="preview-main">
      <h3 class="preview-title bidi" dir="auto">${esc(info.title)}</h3>
      <div class="preview-meta">
        <span class="kind-badge">${esc(T[P.getProvider(platform).nameKey] || platform)}</span>
        ${info.uploader ? `<span>${esc(T.channel)}: ${esc(info.uploader)}</span>` : ''}
        ${info.duration ? `<span>${esc(T.duration)}: ${fmtDur(info.duration)}</span>` : ''}
        ${info.views ? `<span>${esc(T.views)}: ${fmtViews(info.views)}</span>` : ''}
      </div>
      ${platform === 'web' ? `<div class="status-line warn-line">${esc(T.genericWarn)}</div>` : ''}
      <div class="opt-label">${esc(T.quality)}</div>
      <div class="q-list" data-role="qualities"></div>
      <div class="opt-row">
        <label class="opt-field"><span>${esc(T.subtitles)}</span>
          <select data-role="sublang">${subOpts}</select></label>
        <label class="opt-field"><span>${esc(T.subsMode)}</span>
          <select data-role="subsmode">
            <option value="embedded">${esc(T.modeEmbedded)}</option>
            <option value="separate">${esc(T.modeSeparate)}</option>
            <option value="disabled">${esc(T.modeDisabled)}</option>
          </select></label>
        <label class="opt-field"><span>${esc(T.thumbMode)}</span>
          <select data-role="thumbmode">
            <option value="embedded">${esc(T.modeEmbedded)}</option>
            <option value="separate">${esc(T.modeSeparate)}</option>
            <option value="disabled">${esc(T.modeDisabled)}</option>
          </select></label>
        ${accountOpts() ? `<label class="opt-field"><span>${esc(T.sessUse)}</span>
          <select data-role="sessuse">
            <option value="on">${esc(T.sessInherit)}</option>
            <option value="off">${esc(T.sessOff)}</option>
          </select></label>` : ''}
      </div>
      <div class="preview-actions">
        <button class="btn btn-primary" data-role="download">${icon('dl')}<span>${esc(T.download)}</span></button>
        <button class="btn" data-role="audio">${esc(T.audioOnly)}</button>
      </div>
    </div>`;
  mount.appendChild(wrap);

  // quality options: best + audio are always real; heights come from the extractor
  const qList = qs('[data-role="qualities"]', wrap);
  let chosen = { formatId: 'best', label: T.qualityBest };
  const mkQ = (formatId, label, size) => {
    const b = document.createElement('button');
    b.className = 'q-opt' + (formatId === chosen.formatId ? ' selected' : '');
    b.innerHTML = `${esc(label)}${size ? `<small>${esc(fmtBytes(size / 1024))}</small>` : ''}`;
    b.addEventListener('click', () => {
      chosen = { formatId, label };
      qsAll('.q-opt', qList).forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
    });
    qList.appendChild(b);
  };
  mkQ('best', T.qualityBest, 0);
  const quals = (info.qualities || []).slice();
  if (cfg.defaultQuality !== 'best') {
    const want = Number(cfg.defaultQuality);
    const near = quals.filter((q) => q.height <= want).sort((a, b) => b.height - a.height)[0] || quals[0];
    if (near) chosen = { formatId: near.formatId, label: near.height + 'p' };
  }
  for (const q of quals) mkQ(q.formatId, q.height + 'p' + (q.fps > 30 ? ' ' + q.fps : '') + (q.hdr ? ' HDR' : ''), q.size);
  qsAll('.q-opt', qList).forEach((x) => x.classList.toggle('selected', x.textContent.startsWith(chosen.label)));

  qs('[data-role="subsmode"]', wrap).value = cfg.subsMode;
  qs('[data-role="thumbmode"]', wrap).value = cfg.thumbMode;
  const subSel = qs('[data-role="sublang"]', wrap);
  if (cfg.defaultSubLang) {
    const has = [...subSel.options].some((o) => o.value === cfg.defaultSubLang);
    if (has) subSel.value = cfg.defaultSubLang;
  }
  const sessSel = qs('[data-role="sessuse"]', wrap);
  const base = () => ({
    url: info.url || sourceUrl, title: info.title, platform,
    thumb: info.thumb, subLang: subSel.value || '',
    subsMode: qs('[data-role="subsmode"]', wrap).value,
    thumbMode: qs('[data-role="thumbmode"]', wrap).value,
    useAccount: sessSel ? sessSel.value !== 'off' : undefined,
  });
  qs('[data-role="download"]', wrap).addEventListener('click', () => {
    enqueue({ ...base(), kind: 'video', formatId: chosen.formatId, formatLabel: chosen.label });
    toast(T.addedToQueue);
    go('queue');
  });
  qs('[data-role="audio"]', wrap).addEventListener('click', () => {
    enqueue({ ...base(), kind: 'audio', formatId: 'audio', formatLabel: T.audioOnly });
    toast(T.addedToQueue);
    go('queue');
  });
}

function mountImage(mount, info, sourceUrl) {
  const platform = P.detect(sourceUrl) || 'web';
  const wrap = document.createElement('div');
  wrap.className = 'preview card';
  const dims = info.image && info.image.width ? `${info.image.width}×${info.image.height}` : '';
  wrap.innerHTML = `
    <div class="preview-media">${info.thumb ? `<img src="${esc(info.thumb)}" alt="">` : ''}</div>
    <div class="preview-main">
      <h3 class="preview-title bidi" dir="auto">${esc(info.title)}</h3>
      <div class="preview-meta">
        <span class="kind-badge">${esc(T[P.getProvider(platform).nameKey] || platform)}</span>
        <span class="kind-badge">${esc(T.typeImage)}</span>
        ${dims ? `<span class="mono">${dims}</span>` : ''}
        ${info.image && info.image.size ? `<span>${esc(T.size)}: ${esc(fmtBytes(info.image.size / 1024))}</span>` : ''}
      </div>
      <div class="preview-actions">
        <button class="btn btn-primary" data-role="download">${icon('dl')}<span>${esc(T.imgDownload)}</span></button>
      </div>
    </div>`;
  mount.appendChild(wrap);
  qs('[data-role="download"]', wrap).addEventListener('click', () => {
    enqueue({
      url: info.url || sourceUrl, title: info.title, platform, thumb: info.thumb,
      kind: 'image', formatId: info.image ? info.image.formatId : 'best', formatLabel: T.typeImage,
    });
    toast(T.addedToQueue);
    go('queue');
  });
}

function mountPlaylist(mount, info, sourceUrl) {
  const platform = P.detect(sourceUrl) || 'web';
  const pid = 'pl' + Date.now().toString(36);
  const wrap = document.createElement('div');
  const firstThumb = (info.entries && info.entries[0] && info.entries[0].thumb) || '';
  wrap.innerHTML = `
    <div class="pl-head card">
      ${firstThumb ? `<img src="${esc(firstThumb)}" alt="">` : ''}
      <div>
        <div class="pl-head-title bidi" dir="auto">${esc(info.title || T.playlistBadge)}</div>
        <div class="preview-meta"><span class="kind-badge">${esc(T[P.getProvider(platform).nameKey] || platform)}</span>
        <span>${(info.entries || []).length} ${esc(T.items)}</span></div>
      </div>
    </div>
    <div class="pl-toolbar">
      <button class="btn btn-small" data-role="all">${esc(T.selectAll)}</button>
      <button class="btn btn-small" data-role="none">${esc(T.deselectAll)}</button>
      <span class="grow"></span>
      <button class="btn btn-primary" data-role="go">${esc(T.downloadSelected)}</button>
    </div>
    <div class="list" data-role="entries"></div>`;
  mount.appendChild(wrap);
  const list = qs('[data-role="entries"]', wrap);
  for (const e of info.entries || []) {
    const row = document.createElement('label');
    row.className = 'row-item check-line';
    row.innerHTML = `
      <input type="checkbox" checked data-url="${esc(e.url)}" data-title="${esc(e.title)}" data-thumb="${esc(e.thumb || '')}">
      ${e.thumb ? `<img class="row-thumb" src="${esc(e.thumb)}" alt="" loading="lazy">` : ''}
      <span class="row-main">
        <span class="row-title bidi" dir="auto">${esc(e.title)}</span>
        <span class="row-meta">${e.uploader ? `<span>${esc(e.uploader)}</span>` : ''}${e.duration ? `<span>${fmtDur(e.duration)}</span>` : ''}</span>
      </span>`;
    list.appendChild(row);
  }
  const boxes = () => qsAll('input[type="checkbox"]', list);
  qs('[data-role="all"]', wrap).addEventListener('click', () => boxes().forEach((b) => { b.checked = true; }));
  qs('[data-role="none"]', wrap).addEventListener('click', () => boxes().forEach((b) => { b.checked = false; }));
  qs('[data-role="go"]', wrap).addEventListener('click', () => {
    let n = 0;
    for (const b of boxes()) {
      if (!b.checked) continue;
      enqueue({
        url: b.dataset.url, title: b.dataset.title, thumb: b.dataset.thumb,
        platform, kind: 'video', formatId: 'best', formatLabel: T.qualityBest, playlistId: pid,
      });
      n++;
    }
    if (n) { toast(T.addedToQueue); go('queue'); }
  });
}

/* ---------------------------------------------------------- home ------ */
function platformCard(p, onClick) {
  const b = document.createElement('button');
  b.className = 'platform-card';
  const chips = (p.features || []).map((f) => `<span class="chip">${esc(T[f] || '')}</span>`).join('');
  b.innerHTML = `
    <span class="platform-dot" style="background:${PLATFORM_COLORS[p.id] || '#888'}"></span>
    <span class="platform-body"><span class="platform-name">${esc(T[p.nameKey] || p.id)}</span>
    <span class="platform-note" style="display:block">${esc(T[p.noteKey] || '')}</span>
    ${chips ? `<span class="feat-chips">${chips}</span>` : ''}</span>`;
  b.addEventListener('click', onClick);
  return b;
}
function renderPlatformGrid() {
  const grid = qs('#platform-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const p of [...P.PROVIDERS, P.FALLBACK]) {
    grid.appendChild(platformCard(p, () => {
      if (p.id === 'youtube') { go('search'); qs('#search-input').focus(); }
      else { go('new'); qs('#new-url').focus(); }
    }));
  }
}
/** Explore block on the Search page: same platforms, routed to the
 *  listing page - the honest answer to "why does only YouTube search". */
function renderExploreGrid() {
  const grid = qs('#explore-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const p of P.PROVIDERS) {
    grid.appendChild(platformCard(p, () => {
      if (p.id === 'youtube') { qs('#search-input').focus(); window.scrollTo(0, 0); return; }
      go('playlists');
      qs('#pl-url').focus();
    }));
  }
}
function wirePaste(inputSel, tagSel) {
  const input = qs(inputSel), tag = qs(tagSel);
  if (!input) return;
  input.addEventListener('input', () => {
    const id = P.detect(input.value.trim());
    if (id) { tag.hidden = false; tag.textContent = T[P.getProvider(id).nameKey] || id; }
    else tag.hidden = true;
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.dispatchEvent(new CustomEvent('kt-fetch')); });
}
wirePaste('#home-url', '#home-platform');
wirePaste('#new-url', '#new-platform');
qs('#home-fetch').addEventListener('click', () => startFetch(qs('#home-url').value));
qs('#home-url').addEventListener('kt-fetch', () => startFetch(qs('#home-url').value));
qs('#new-fetch').addEventListener('click', () => startFetch(qs('#new-url').value));
qs('#new-url').addEventListener('kt-fetch', () => startFetch(qs('#new-url').value));

function skeletonPreview(mount) {
  mount.innerHTML = `
    <div class="preview card" aria-hidden="true">
      <div class="preview-media"><div class="skl skl-thumb"></div></div>
      <div class="preview-main">
        <div class="skl skl-line w70"></div>
        <div class="skl skl-line w45"></div>
        <div class="skl skl-line w85"></div>
        <div class="skl skl-line w55"></div>
      </div>
    </div>`;
}
function friendlyError(raw) {
  const m = String(raw || '');
  if (/blocked-by-user-list/.test(m)) return T.blockedMsg || m;
  if (/Sign in to confirm|not a bot/i.test(m)) return T.fetchFailed + ' ' + (T.botCheckHint || '');
  if (/login required|sign in|cookies/i.test(m) && cfg.accountMode === 'off') return T.fetchFailed + ' ' + (T.loginNeededHint || '');
  return T.fetchFailed + ' — ' + m.slice(0, 160);
}

async function startFetch(raw) {
  const url = String(raw || '').trim();
  go('new');
  qs('#new-url').value = url;
  qs('#new-url').dispatchEvent(new Event('input'));
  const status = qs('#new-status');
  const mount = qs('#new-preview');
  mount.innerHTML = '';
  if (!/^https?:\/\//i.test(url)) {
    status.hidden = false; status.className = 'status-line err'; status.textContent = T.invalidUrl;
    return;
  }
  if (urlBlocked(url)) {
    status.hidden = false; status.className = 'status-line err'; status.textContent = T.blockedMsg;
    return;
  }
  status.hidden = false; status.className = 'status-line'; status.textContent = T.fetchingInfo;
  skeletonPreview(mount);
  try {
    const opts = accountOpts();
    let info = null;
    try { info = await K.info(url, proxy, opts); } catch (_) { info = null; }
    if (!info) info = await K.playlist(url, proxy, opts);
    status.hidden = true;
    mountPreview(mount, info, url);
  } catch (e) {
    mount.innerHTML = '';
    status.hidden = false; status.className = 'status-line err';
    status.textContent = friendlyError(e && e.message);
  }
}

/* -------------------------------------------------------- search ------ */
async function runSearch() {
  const q = qs('#search-input').value.trim();
  const status = qs('#search-status');
  const grid = qs('#search-results');
  if (!q) return;
  if (/^https?:\/\//i.test(q)) { startFetch(q); return; }
  status.textContent = T.searching;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const sk = document.createElement('div');
    sk.className = 'vcard';
    sk.innerHTML = '<div class="vcard-thumb skl"></div><div class="vcard-body"><div class="skl skl-line w85"></div><div class="skl skl-line w55"></div></div>';
    grid.appendChild(sk);
  }
  try {
    const items = await K.search(q, proxy);
    grid.innerHTML = '';
    status.textContent = items.length ? `${items.length} ${T.results}` : (T.searchHint || '');
    for (const it of items) grid.appendChild(searchCard(it));
  } catch (e) {
    status.textContent = T.searchFailed;
  }
}
function searchCard(it) {
  const el = document.createElement('div');
  el.className = 'vcard';
  el.innerHTML = `
    <div class="vcard-thumb">
      ${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : ''}
      ${it.isPlaylist ? `<span class="vcard-pl">${esc(T.playlistBadge)}${it.count ? ' · ' + it.count : ''}</span>` : (it.duration ? `<span class="vcard-dur">${fmtDur(it.duration)}</span>` : '')}
    </div>
    <div class="vcard-body">
      <div class="vcard-title bidi" dir="auto" title="${esc(it.title)}">${esc(it.title)}</div>
      <div class="vcard-meta">${esc(it.uploader || '')}${it.views ? ' · ' + fmtViews(it.views) + ' ' + esc(T.views) : ''}</div>
      <div class="vcard-actions">
        <button class="btn btn-small btn-primary" data-a="dl">${esc(T.download)}</button>
        <button class="btn btn-small" data-a="opt">${esc(T.quality)}</button>
      </div>
    </div>`;
  qs('[data-a="dl"]', el).addEventListener('click', () => {
    if (it.isPlaylist) { go('playlists'); qs('#pl-url').value = it.url; loadPlaylist(); return; }
    enqueue({ url: it.url, title: it.title, thumb: it.thumb, platform: 'youtube', kind: 'video', formatId: 'best', formatLabel: T.qualityBest });
    toast(T.addedToQueue); go('queue');
  });
  qs('[data-a="opt"]', el).addEventListener('click', () => {
    if (it.isPlaylist) { go('playlists'); qs('#pl-url').value = it.url; loadPlaylist(); return; }
    startFetch(it.url);
  });
  return el;
}
qs('#search-btn').addEventListener('click', runSearch);
qs('#search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

/* ----------------------------------------------------- playlists ------ */
async function loadPlaylist() {
  const url = qs('#pl-url').value.trim();
  const status = qs('#pl-status');
  const kindLine = qs('#pl-kind');
  const mount = qs('#pl-preview');
  mount.innerHTML = '';
  kindLine.hidden = true;
  if (!/^https?:\/\//i.test(url)) {
    status.hidden = false; status.className = 'status-line err'; status.textContent = T.invalidUrl;
    return;
  }
  if (urlBlocked(url)) {
    status.hidden = false; status.className = 'status-line err'; status.textContent = T.blockedMsg;
    return;
  }
  const kindKey = P.kindOf(url);
  kindLine.hidden = false;
  kindLine.textContent = (T.listDetected || '').replace('{kind}', T[kindKey] || '');
  status.hidden = false; status.className = 'status-line'; status.textContent = T.loadingPlaylist;
  try {
    const info = await K.playlist(url, proxy, accountOpts());
    status.hidden = true;
    mountPlaylist(mount, info, url);
  } catch (e) {
    try {
      const info = await K.info(url, proxy, accountOpts());
      status.hidden = true;
      mountPlaylist(mount, info, url);
    } catch (e2) {
      status.hidden = false; status.className = 'status-line err'; status.textContent = friendlyError(e2 && e2.message);
    }
  }
}
qs('#pl-load').addEventListener('click', loadPlaylist);
qs('#pl-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadPlaylist(); });

/* ------------------------------------------------------- library ------ */
let libFiles = [];
let libKind = 'all';
async function loadLibrary() {
  try {
    const r = await K.libraryList();
    libFiles = r.files || [];
    if (r.dir) downloadsDir = r.dir;
  } catch (_) { libFiles = []; }
  renderLibrary();
}
function renderLibrary() {
  const list = qs('#library-list');
  const q = qs('#lib-search').value.trim().toLowerCase();
  list.innerHTML = '';
  const shown = libFiles.filter((f) =>
    (libKind === 'all' || f.kind === libKind) && (!q || f.name.toLowerCase().includes(q)));
  qs('#library-empty').hidden = shown.length > 0;
  for (const f of shown) {
    const el = document.createElement('div');
    el.className = 'row-item';
    el.innerHTML = `
      <div class="row-main">
        <div class="row-title bidi" dir="auto" title="${esc(f.path)}">${esc(f.name)}</div>
        <div class="row-meta">
          <span class="kind-badge">${esc(f.kind === 'video' ? T.typeVideo : f.kind === 'audio' ? T.typeAudio : T.typeImage)}</span>
          <span>${esc(fmtBytes(f.size / 1024))}</span>
          <span>${esc(new Date(f.mtime).toLocaleDateString(LANG === 'fa' ? 'fa-IR' : LANG))}</span>
        </div>
      </div>
      <div class="row-actions"></div>`;
    const act = qs('.row-actions', el);
    const mk = (ico, title, fn) => {
      const b = document.createElement('button');
      b.className = 'icon-btn'; b.innerHTML = icon(ico); b.title = title || '';
      b.addEventListener('click', fn); act.appendChild(b);
    };
    mk('play', T.openFile, () => K.openFolder(f.path));
    mk('folder', T.openContaining, () => K.showInFolder(f.path));
    mk('copy', T.copyPath, () => { navigator.clipboard.writeText(f.path).catch(() => {}); });
    mk('trash', T.deleteFile, async () => {
      if (!window.confirm(T.confirmDelete)) return;
      if (await K.libraryDelete(f.path)) loadLibrary();
    });
    list.appendChild(el);
  }
}
qs('#lib-search').addEventListener('input', renderLibrary);
qs('#lib-refresh').addEventListener('click', loadLibrary);
qsAll('#lib-filter .seg-btn').forEach((b) => b.addEventListener('click', () => {
  libKind = b.dataset.libKind;
  qsAll('#lib-filter .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
  renderLibrary();
}));

/* ------------------------------------------------------ settings ------ */
function renderAccountRows() {
  qs('#s-account-browser-row').hidden = cfg.accountMode !== 'browser';
  qs('#s-account-file-row').hidden = cfg.accountMode !== 'file';
  qs('#s-cookies-path').textContent = cfg.cookiesFile
    ? cfg.cookiesFile.split(/[\\/]/).pop()
    : (T.accountFileNone || '');
  qs('#s-cookies-path').title = cfg.cookiesFile || '';
}
async function loadSettingsIntoForm() {
  qs('#s-concurrency').value = cfg.concurrency;
  qs('#s-ratelimit').value = cfg.rateLimitKb;
  qs('#s-quality').value = cfg.defaultQuality;
  qs('#s-subsmode').value = cfg.subsMode;
  qs('#s-thumbmode').value = cfg.thumbMode;
  qs('#s-sublang').value = cfg.defaultSubLang;
  qs('#s-account-mode').value = cfg.accountMode;
  qs('#s-account-browser').value = cfg.accountBrowser;
  qs('#s-blockadult').checked = cfg.blockAdult !== false;
  qs('#s-blocked').value = cfg.blockedExtra || '';
  qs('#s-blocked').placeholder = T.blockedPh || '';
  renderAccountRows();
  qs('#s-dir-path').textContent = downloadsDir;
  qs('#dir-path').textContent = downloadsDir;
  try { qs('#s-tunnelmode').value = await K.tunnelModeGet(); } catch (_) { /* default */ }
}
function bindSetting(sel, key, parse) {
  qs(sel).addEventListener('change', async (e) => {
    const v = parse ? parse(e.target.value) : e.target.value;
    cfg[key] = v;
    await K.settingSet(key, v);
  });
}
bindSetting('#s-theme', 'theme');
qs('#s-theme').addEventListener('change', (e) => setTheme(e.target.value));
bindSetting('#s-quality', 'defaultQuality');
bindSetting('#s-concurrency', 'concurrency', (v) => Math.min(5, Math.max(1, parseInt(v, 10) || 2)));
bindSetting('#s-ratelimit', 'rateLimitKb', (v) => Math.max(0, parseInt(v, 10) || 0));
bindSetting('#s-subsmode', 'subsMode');
bindSetting('#s-thumbmode', 'thumbMode');
bindSetting('#s-sublang', 'defaultSubLang');
bindSetting('#s-account-mode', 'accountMode');
qs('#s-account-mode').addEventListener('change', renderAccountRows);
bindSetting('#s-account-browser', 'accountBrowser');
qs('#s-cookies-pick').addEventListener('click', async () => {
  const f = await K.pickCookiesFile();
  if (f) {
    cfg.cookiesFile = f;
    await K.settingSet('cookiesFile', f);
    renderAccountRows();
  }
});
qs('#s-blockadult').addEventListener('change', async (e) => {
  cfg.blockAdult = e.target.checked;
  await K.settingSet('blockAdult', cfg.blockAdult);
});
qs('#s-blocked').addEventListener('change', async (e) => {
  cfg.blockedExtra = e.target.value;
  await K.settingSet('blockedExtra', cfg.blockedExtra);
});
qs('#s-lang').addEventListener('change', async (e) => {
  const r = await K.langSet(e.target.value);
  if (r && r.strings) { LANG = r.language; RTL = !!r.rtl; T = r.strings; applyStrings(); }
});
qs('#s-tunnelmode').addEventListener('change', async (e) => { await K.tunnelModeSet(e.target.value); });
qs('#s-reset').addEventListener('click', async () => {
  if (!window.confirm(T.confirmReset)) return;
  await K.resetConfig();
  toast(T.settingsTitle);
});
async function pickDownloadsDir() {
  const d = await K.pickDir();
  if (d) {
    downloadsDir = d;
    qs('#dir-path').textContent = d;
    qs('#s-dir-path').textContent = d;
  }
}
qs('#s-dir-pick').addEventListener('click', pickDownloadsDir);
qs('#btn-open-folder').addEventListener('click', () => K.openFolder(downloadsDir));

/* ------------------------------------------- topbar quick controls ---- */
qsAll('#theme-seg .seg-btn').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themePick)));
qsAll('#lang-seg .seg-btn').forEach((b) => b.addEventListener('click', async () => {
  if (b.dataset.langPick === LANG) return;
  const r = await K.langSet(b.dataset.langPick);
  if (r && r.strings) { LANG = r.language; RTL = !!r.rtl; T = r.strings; applyStrings(); applyTheme(); }
}));
K.onLang(({ language, strings, rtl }) => { LANG = language; RTL = !!rtl; T = strings; applyStrings(); });

/* ---------------------------------------------------------- versions -- */
async function loadVersions() {
  try {
    const v = await K.versions();
    qs('#v-app').textContent = v.app || '—';
    qs('#v-ytdlp').textContent = v.ytDlp || (T.missing || '—');
    qs('#v-ffmpeg').textContent = v.ffmpeg ? (T.present || '✓') : (T.missing || '—');
    qs('#v-aether').textContent = v.aether ? (T.present || '✓') : (T.missing || '—');
    qs('#a-version').textContent = 'v' + (v.app || '');
  } catch (_) { /* dev without vendor */ }
}

/* -------------------------------------------------------------- boot -- */
(async function boot() {
  const lg = await K.langGet();
  LANG = lg.language || 'fa';
  RTL = !!lg.rtl;
  T = lg.strings || {};
  cfg.theme = (await K.themeGet().catch(() => 'dark')) || 'dark';
  for (const key of ['defaultQuality', 'concurrency', 'rateLimitKb', 'subsMode', 'thumbMode', 'defaultSubLang', 'accountMode', 'accountBrowser', 'cookiesFile', 'blockAdult', 'blockedExtra']) {
    const v = await K.settingGet(key).catch(() => null);
    if (v !== null && v !== undefined) cfg[key] = v;
  }
  // migrate the v3.0 browser-session setting into the account model
  const legacy = await K.settingGet('cookiesBrowser').catch(() => null);
  if (legacy && cfg.accountMode === 'off') {
    cfg.accountMode = 'browser';
    cfg.accountBrowser = legacy;
  }
  downloadsDir = await K.getDownloads().catch(() => '');
  applyTheme();
  applyStrings();
  await loadSettingsIntoForm();
  loadVersions();
  // restore queue + history
  const savedQ = await K.settingGet('queueV3').catch(() => null);
  if (Array.isArray(savedQ)) for (const j of savedQ) { jobs.set(j.id, j); renderQueueItem(j); }
  const savedH = await K.settingGet('historyV3').catch(() => null);
  if (Array.isArray(savedH)) { history.push(...savedH); renderHistory(); renderHomeRecent(); }
  updateQueueChrome();
  refreshDiagnostics();
  go('home');
})();
