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
    capabilities: {
      search: false, playlists: false, subtitles: false, thumbnail: true,
      qualities: false, audioExtract: false, collections: true, images: true,
    },
  },
  {
    id: 'instagram',
    nameKey: 'platformInstagram',
    noteKey: 'noteInstagram',
    hosts: ['instagram.com'],
    capabilities: {
      search: false, playlists: false, subtitles: false, thumbnail: true,
      qualities: false, audioExtract: false, collections: true, images: true,
      loginMayBeRequired: true,
    },
  },
  {
    id: 'tiktok',
    nameKey: 'platformTikTok',
    noteKey: 'noteTikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    capabilities: {
      search: false, playlists: false, subtitles: false, thumbnail: true,
      qualities: false, audioExtract: true, collections: false, images: true,
    },
  },
  {
    id: 'x',
    nameKey: 'platformX',
    noteKey: 'noteX',
    hosts: ['x.com', 'twitter.com'],
    capabilities: {
      search: false, playlists: false, subtitles: false, thumbnail: true,
      qualities: true, audioExtract: true, collections: true, images: true,
    },
  },
];

const FALLBACK = {
  id: 'web',
  nameKey: 'platformWeb',
  noteKey: 'noteWeb',
  hosts: [],
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
  if (provider.hostPattern) return provider.hostPattern.test(h);
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

const api = { PROVIDERS, FALLBACK, detect, getProvider, getCapabilities, canHandle, hostOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.KamanProviders = api;
