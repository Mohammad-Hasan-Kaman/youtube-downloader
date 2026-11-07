'use strict';
/**
 * Unit tests for src/providers.js - URL detection, capabilities,
 * listing kind, and the site blocklist. Pure logic, no Electron.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const P = require('../src/providers');

/* ------------------------------------------------------------ detect -- */

test('detect: YouTube URL forms', () => {
  assert.equal(P.detect('https://www.youtube.com/watch?v=jNQXAC9IVRw'), 'youtube');
  assert.equal(P.detect('https://youtube.com/watch?v=jNQXAC9IVRw'), 'youtube');
  assert.equal(P.detect('https://youtu.be/jNQXAC9IVRw'), 'youtube');
  assert.equal(P.detect('https://music.youtube.com/watch?v=jNQXAC9IVRw'), 'youtube');
  assert.equal(P.detect('https://www.youtube-nocookie.com/embed/jNQXAC9IVRw'), 'youtube');
  assert.equal(P.detect('https://m.youtube.com/watch?v=jNQXAC9IVRw'), 'youtube');
});

test('detect: Pinterest URL forms, incl. pin.it short links and regional domains', () => {
  assert.equal(P.detect('https://www.pinterest.com/pin/123456789/'), 'pinterest');
  assert.equal(P.detect('https://pinterest.co.uk/pin/123456789/'), 'pinterest');
  assert.equal(P.detect('https://www.pinterest.de/pin/123456789/'), 'pinterest');
  assert.equal(P.detect('https://pin.it/AbCdEfG'), 'pinterest');
});

test('detect: Instagram URL forms', () => {
  assert.equal(P.detect('https://www.instagram.com/reel/ABC123/'), 'instagram');
  assert.equal(P.detect('https://instagram.com/p/ABC123/'), 'instagram');
});

test('detect: TikTok URL forms, incl. short-link hosts', () => {
  assert.equal(P.detect('https://www.tiktok.com/@user/video/123456'), 'tiktok');
  assert.equal(P.detect('https://vm.tiktok.com/AbCdEf/'), 'tiktok');
  assert.equal(P.detect('https://vt.tiktok.com/AbCdEf/'), 'tiktok');
});

test('detect: X and legacy Twitter URL forms', () => {
  assert.equal(P.detect('https://x.com/user/status/123456'), 'x');
  assert.equal(P.detect('https://twitter.com/user/status/123456'), 'x');
  assert.equal(P.detect('https://www.x.com/user/status/123456'), 'x');
});

test('detect: unknown hosts fall back to the generic web provider', () => {
  assert.equal(P.detect('https://vimeo.com/123456'), 'web');
  assert.equal(P.detect('https://example.com/some/video'), 'web');
  // lookalike hosts must not match a platform
  assert.equal(P.detect('https://notyoutube.com/watch?v=x'), 'web');
  assert.equal(P.detect('https://youtube.com.evil.example/watch?v=x'), 'web');
});

test('detect: non-URLs and non-http(s) input return null', () => {
  assert.equal(P.detect(''), null);
  assert.equal(P.detect('   '), null);
  assert.equal(P.detect('not a url'), null);
  assert.equal(P.detect(null), null);
  assert.equal(P.detect(undefined), null);
  assert.equal(P.detect('ftp://youtube.com/watch?v=x'), null);
});

/* --------------------------------------------------------- providers -- */

test('registry: exactly the five platforms plus the web fallback', () => {
  assert.deepEqual(P.PROVIDERS.map((p) => p.id),
    ['youtube', 'pinterest', 'instagram', 'tiktok', 'x']);
  assert.equal(P.FALLBACK.id, 'web');
  assert.equal(P.getProvider('nope').id, 'web');
  assert.equal(P.getProvider('youtube').id, 'youtube');
});

test('capabilities: flags match what the extractors really offer', () => {
  const yt = P.getCapabilities('youtube');
  assert.equal(yt.search, true);
  assert.equal(yt.subtitles, true);
  assert.equal(yt.audioExtract, true);

  for (const id of ['pinterest', 'instagram', 'tiktok', 'x']) {
    assert.equal(P.getCapabilities(id).search, false, `${id} has no in-app search`);
  }
  assert.equal(P.getCapabilities('instagram').loginMayBeRequired, true);
  assert.equal(P.getCapabilities('instagram').qualities, false);
  assert.equal(P.getCapabilities('pinterest').images, true);
  assert.equal(P.getCapabilities('tiktok').audioExtract, true);
  assert.equal(P.getCapabilities('x').qualities, true);
});

test('hostOf: strips www, lowercases, rejects garbage', () => {
  assert.equal(P.hostOf('https://WWW.YouTube.COM/watch?v=x'), 'youtube.com');
  assert.equal(P.hostOf('https://youtu.be/abc'), 'youtu.be');
  assert.equal(P.hostOf('not a url'), '');
  assert.equal(P.hostOf(''), '');
});

/* ------------------------------------------------------------ kindOf -- */

test('kindOf: YouTube playlists vs channels', () => {
  assert.equal(P.kindOf('https://www.youtube.com/playlist?list=PLabc'), 'kindPlaylist');
  assert.equal(P.kindOf('https://www.youtube.com/watch?v=x&list=PLabc'), 'kindPlaylist');
  assert.equal(P.kindOf('https://www.youtube.com/@SomeChannel'), 'kindChannel');
  assert.equal(P.kindOf('https://www.youtube.com/channel/UCabc'), 'kindChannel');
});

test('kindOf: Pinterest boards vs profiles vs single pins', () => {
  assert.equal(P.kindOf('https://www.pinterest.com/user/my-board/'), 'kindBoard');
  assert.equal(P.kindOf('https://www.pinterest.com/user/'), 'kindProfile');
  assert.equal(P.kindOf('https://www.pinterest.com/pin/123/'), 'kindProfile');
});

test('kindOf: profile-based platforms and fallback', () => {
  assert.equal(P.kindOf('https://www.tiktok.com/@user'), 'kindProfile');
  assert.equal(P.kindOf('https://www.instagram.com/user/'), 'kindProfile');
  assert.equal(P.kindOf('https://x.com/user'), 'kindProfile');
  assert.equal(P.kindOf('https://vimeo.com/showcase/1'), 'kindPlaylist');
});

/* ---------------------------------------------------------- blocking -- */

test('blocklist: built-in list is comprehensive and ON by default', () => {
  assert.ok(P.ADULT_HOSTS.length >= 100, `expected 100+ hosts, got ${P.ADULT_HOSTS.length}`);
  assert.equal(P.isBlocked('https://pornhub.com/view_video.php?viewkey=x', {}), true);
  assert.equal(P.isBlocked('https://www.xvideos.com/video123/x', {}), true);
  assert.equal(P.isBlocked('https://pornhub.com/x'), true); // opts omitted entirely
});

test('blocklist: subdomains of blocked hosts match, lookalikes do not', () => {
  assert.equal(P.isBlocked('https://de.xhamster.com/videos/x', {}), true);
  assert.equal(P.isBlocked('https://notpornhub.com/x', {}), false);
  assert.equal(P.isBlocked('https://pornhub.com.evil.example/x', {}), false);
});

test('blocklist: filter is always on - no opt-out, no user lists (v3.1)', () => {
  assert.equal(P.isBlocked('https://pornhub.com/x', { adult: false }), true);
  assert.equal(P.isBlocked('https://example.org/x', { extra: 'example.org' }), false);
});

test('blocklist: ordinary sites are never blocked by default', () => {
  assert.equal(P.isBlocked('https://www.youtube.com/watch?v=x', {}), false);
  assert.equal(P.isBlocked('https://www.tiktok.com/@u/video/1', {}), false);
  assert.equal(P.isBlocked('not a url', {}), false);
  assert.equal(P.isBlocked('', {}), false);
});

test('blocklist: coverage spans tubes, cams, studios and hentai', () => {
  for (const u of [
    'https://www.nhentai.net/g/1', 'https://camsoda.com/x',
    'https://bangbros.com/x', 'https://fansly.com/x',
    'https://hanime.tv/x', 'https://www.motherless.com/x',
  ]) assert.equal(P.isBlocked(u), true, u);
});
