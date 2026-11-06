'use strict';
/**
 * KamanTube - platform provider registry (Universal Download Engine).
 *
 * One shared contract for every platform module:
 *   canHandle(url)        -> boolean
 *   detect(url)           -> provider id
 *   getCapabilities(id)   -> capability flags actually backed by yt-dlp
 *
 * Extraction and downloading for all providers run through the same
 * yt-dlp service; a provider only adds URL detection, capability flags
 * and platform-specific limits. Nothing here claims a capability that
 * the underlying extractor does not really have.
 *
 * Loaded by the renderer as a plain script (window.KamanProviders) and
 * by the main process through require().
 */

const PROVIDERS = [
  {
    id: 'youtube',
    nameKey: 'platformYouTube',
    noteKey: 'noteYouTube',
    hosts: ['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'],
    features: ['featSearch', 'featPlaylists', 'featChannels', 'featSubtitles', 'featQualities', 'featAudio'],
    capabilities: {
      search: true, playlists: true, subtitles: true, thumbnail: true,
      qualities: true, audioExtract: true, collections: true,
    },
  },
  {
    id: 'pinterest',
    nameKey: 'platformPinterest',
    noteKey: 'notePinterest',
    hosts: ['pinterest.com', 'pin.it'],
    hostPattern: /(^|\.)pinterest\.[a-z.]+$/,
    features: ['featBoards', 'featImages', 'featQualities', 'featChannels'],
    capabilities: {
      search: false, playlists: true, subtitles: false, thumbnail: true,
      qualities: true, audioExtract: false, collections: true, images: true,
    },
  },
  {
    id: 'instagram',
    nameKey: 'platformInstagram',
    noteKey: 'noteInstagram',
    hosts: ['instagram.com'],
    features: ['featCarousel', 'featImages', 'featStories', 'featLogin'],
    capabilities: {
      search: false, playlists: true, subtitles: false, thumbnail: true,
      qualities: false, audioExtract: false, collections: true, images: true,
      loginMayBeRequired: true,
    },
  },
  {
    id: 'tiktok',
    nameKey: 'platformTikTok',
    noteKey: 'noteTikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    features: ['featChannels', 'featQualities', 'featAudio', 'featImages'],
    capabilities: {
      search: false, playlists: true, subtitles: false, thumbnail: true,
      qualities: true, audioExtract: true, collections: true, images: true,
    },
  },
  {
    id: 'x',
    nameKey: 'platformX',
    noteKey: 'noteX',
    hosts: ['x.com', 'twitter.com'],
    features: ['featChannels', 'featQualities', 'featAudio', 'featImages'],
    capabilities: {
      search: false, playlists: true, subtitles: false, thumbnail: true,
      qualities: true, audioExtract: true, collections: true, images: true,
    },
  },
];

const FALLBACK = {
  id: 'web',
  nameKey: 'platformWeb',
  noteKey: 'noteWeb',
  hosts: [],
  features: ['featQualities', 'featPlaylists', 'featAudio'],
  capabilities: {
    search: false, playlists: true, subtitles: true, thumbnail: true,
    qualities: true, audioExtract: true, collections: true, images: true,
  },
};

function hostOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase(); }
  catch (_) { return ''; }
}

function canHandle(provider, url) {
  const h = hostOf(url);
  if (!h) return false;
  // A provider matches when its host pattern matches OR one of its
  // listed hosts does. (The pattern alone missed listed short-link
  // hosts such as pin.it, which fell through to the generic provider.)
  if (provider.hostPattern && provider.hostPattern.test(h)) return true;
  return provider.hosts.some((x) => h === x || h.endsWith('.' + x));
}

function detect(url) {
  if (!/^https?:\/\//i.test(String(url || '').trim())) return null;
  for (const p of PROVIDERS) if (canHandle(p, url)) return p.id;
  return 'web';
}

function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || FALLBACK;
}

function getCapabilities(id) {
  return getProvider(id).capabilities;
}

/**
 * What kind of listing a URL points at, for the Playlists & Profiles
 * page: a real playlist, a channel, a user profile, or a board.
 * Returns an i18n key (kindPlaylist / kindChannel / kindProfile / kindBoard).
 */
function kindOf(url) {
  const id = detect(url);
  let path = '';
  try { path = new URL(String(url)).pathname; } catch (_) { return 'kindPlaylist'; }
  if (id === 'youtube') {
    if (/[?&]list=/.test(String(url)) || /\/playlist/.test(path)) return 'kindPlaylist';
    if (/^\/(channel|c|user|@)/.test(path)) return 'kindChannel';
    return 'kindPlaylist';
  }
  if (id === 'pinterest') {
    if (/\/pin\//.test(path)) return 'kindProfile'; // single pin, not a listing
    const seg = path.split('/').filter(Boolean);
    return seg.length >= 2 ? 'kindBoard' : 'kindProfile';
  }
  if (id === 'instagram' || id === 'tiktok' || id === 'x') return 'kindProfile';
  return 'kindPlaylist';
}

/* ---------------------------------------------------------- blocking -- */
/**
 * Built-in adult-site blocklist (hostnames; subdomains included).
 * The user explicitly asked that downloads from such platforms are
 * refused. Enforced in the main process for every info/playlist/
 * download call, and pre-checked in the renderer for instant feedback.
 * The user can extend it with extra domains and can switch the
 * built-in list off in Settings - but it ships ON.
 */
const ADULT_HOSTS = [
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'brazzers.com', 'onlyfans.com', 'chaturbate.com',
  'livejasmin.com', 'stripchat.com', 'bongacams.com', 'myfreecams.com',
  'spankbang.com', 'eporner.com', 'porntrex.com', 'faphouse.com',
  'rule34.xxx', 'hentaihaven.xxx', 'hanime.tv',
];

function hostBlocked(host, list) {
  if (!host) return false;
  return list.some((d) => host === d || host.endsWith('.' + d));
}

function parseBlockedExtra(text) {
  return String(text || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, ''))
    .filter(Boolean);
}

/** opts: { adult: boolean, extra: string|string[] } */
function isBlocked(url, opts) {
  const host = hostOf(url);
  if (!host) return false;
  const o = opts || {};
  if (o.adult !== false && hostBlocked(host, ADULT_HOSTS)) return true;
  const extra = Array.isArray(o.extra) ? o.extra : parseBlockedExtra(o.extra);
  return hostBlocked(host, extra);
}

const api = {
  PROVIDERS, FALLBACK, detect, getProvider, getCapabilities, canHandle, hostOf,
  kindOf, ADULT_HOSTS, isBlocked, parseBlockedExtra,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.KamanProviders = api;
