'use strict';
/**
 * Unit tests for the pure parts of src/yt.js - the info-shape mapping
 * (qualities, audio, subtitles, image-only media) and the argument
 * builder for account access. No yt-dlp binary is invoked.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { YtdlpService } = require('../src/yt');

const svc = new YtdlpService('/nonexistent-vendor-dir');

function fmt(over) {
  return {
    format_id: 'f', vcodec: 'avc1', acodec: 'none', height: 720,
    fps: 30, tbr: 1000, ext: 'mp4', video_ext: 'mp4', dynamic_range: 'SDR',
    ...over,
  };
}

/* --------------------------------------------------------- _videoShape */

test('video shape: best variant per height, muxed preferred, sorted desc', () => {
  const shape = svc._videoShape({
    id: 'abc', title: 'T', webpage_url: 'https://www.youtube.com/watch?v=abc', formats: [
      fmt({ format_id: 'v720-muted', height: 720, tbr: 2000 }),
      fmt({ format_id: 'v720-muxed', height: 720, tbr: 900, acodec: 'mp4a' }),
      fmt({ format_id: 'v360', height: 360, tbr: 500 }),
      fmt({ format_id: 'v1080', height: 1080, tbr: 3000 }),
      { format_id: 'a1', vcodec: 'none', acodec: 'mp4a', abr: 128, ext: 'm4a' },
    ],
    subtitles: {},
  });
  assert.equal(shape.type, 'video');
  assert.deepEqual(shape.qualities.map((q) => q.height), [1080, 720, 360]);
  // the muxed (audio-carrying) 720p wins over the higher-bitrate muted one
  assert.equal(shape.qualities[1].formatId, 'v720-muxed');
  assert.equal(shape.audio.formatId, 'a1');
  assert.equal(shape.audio.ext, 'm4a');
});

test('video shape: subtitle list comes from the tracks the video really has', () => {
  const shape = svc._videoShape({
    id: 'abc', formats: [fmt({})],
    subtitles: { en: [{ ext: 'vtt' }], fa: [{ ext: 'vtt' }], xx: [] },
  }, 'https://www.youtube.com/watch?v=abc');
  assert.deepEqual(shape.subtitles.map((s) => s.lang), ['en', 'fa']);
});

test('video shape: automatic captions are a separate list from manual subtitles', () => {
  const shape = svc._videoShape({
    id: 'abc', formats: [fmt({})],
    subtitles: { en: [{ ext: 'vtt' }] },
    automatic_captions: { en: [{ ext: 'vtt' }], de: [{ ext: 'vtt' }], fr: [] },
  }, 'https://www.youtube.com/watch?v=abc');
  assert.deepEqual(shape.subtitles.map((s) => s.lang), ['en']);
  // 'en' also exists as a manual track, so it is not repeated as an
  // automatic caption; languages with no tracks never appear either.
  assert.deepEqual(shape.autoSubtitles.map((s) => s.lang), ['de']);
});

test('video shape: no automatic_captions in extractor output -> empty auto list', () => {
  const shape = svc._videoShape({ id: 'x', formats: [fmt({})], subtitles: {} }, 'https://example.com/v');
  assert.deepEqual(shape.autoSubtitles, []);
});

test('video shape: url falls back to the requested URL when the extractor omits one', () => {
  // Regression: _videoShape used to reference an undefined `url` variable
  // and throw a ReferenceError on this path.
  const shape = svc._videoShape(
    { id: 'abc', formats: [fmt({})], subtitles: {} },
    'https://www.youtube.com/watch?v=abc');
  assert.equal(shape.url, 'https://www.youtube.com/watch?v=abc');
});

test('video shape: image-only media (e.g. a Pinterest image pin) maps to type image', () => {
  const shape = svc._videoShape({
    id: 'pin1', title: 'Pin', webpage_url: 'https://www.pinterest.com/pin/1/',
    formats: [
      { format_id: 'img', vcodec: 'none', acodec: 'none', ext: 'jpg', width: 1200, height: 800, filesize: 12345, url: 'https://i.pinimg.com/x.jpg' },
    ],
  });
  assert.equal(shape.type, 'image');
  assert.equal(shape.image.ext, 'jpg');
  assert.equal(shape.image.width, 1200);
  assert.deepEqual(shape.qualities, []);
});

test('video shape: no playable formats and no image -> empty qualities, no crash', () => {
  const shape = svc._videoShape({ id: 'x', formats: [], subtitles: {} }, 'https://example.com/v');
  assert.equal(shape.type, 'video');
  assert.deepEqual(shape.qualities, []);
  assert.equal(shape.audio, null);
});

/* ------------------------------------------------------- _playlistShape */

test('playlist shape: entries normalised, missing URLs rebuilt as watch URLs', () => {
  const shape = svc._playlistShape({
    title: 'PL', webpage_url: 'https://www.youtube.com/playlist?list=PL1',
    entries: [
      { id: 'v1', url: 'https://www.youtube.com/watch?v=v1', title: 'One' },
      { id: 'v2', title: 'Two' },
      null,
    ],
  });
  assert.equal(shape.type, 'playlist');
  assert.equal(shape.entries.length, 2);
  assert.equal(shape.entries[0].idx, 0);
  assert.equal(shape.entries[1].url, 'https://www.youtube.com/watch?v=v2');
});

/* ---------------------------------------------------------- _commonArgs */

test('common args: no account access by default - no cookie arguments at all', () => {
  const args = svc._commonArgs('', [], null);
  assert.ok(!args.includes('--cookies'));
  assert.ok(!args.includes('--cookies-from-browser'));
  assert.ok(!args.includes('--proxy'));
});

test('common args: proxy and opt-in account access are passed through', () => {
  const byFile = svc._commonArgs('socks5://127.0.0.1:1819', [], { cookiesFile: 'C:/c/cookies.txt' });
  assert.ok(byFile.includes('--proxy'));
  assert.deepEqual(byFile.slice(byFile.indexOf('--cookies')), ['--cookies', 'C:/c/cookies.txt']);

  const byBrowser = svc._commonArgs('', [], { cookiesBrowser: 'chrome' });
  assert.deepEqual(byBrowser.slice(byBrowser.indexOf('--cookies-from-browser')),
    ['--cookies-from-browser', 'chrome']);
});

/* ------------------------------------------------------------ _subArgs */

const subJob = (over) => ({
  kind: 'video', subLang: 'en', subLangs: ['en'], subAutoLangs: [], ...over,
});

test('sub args: manual language, separate file - --write-sub, never --write-auto-subs', () => {
  assert.deepEqual(svc._subArgs(subJob({}), 'separate'),
    ['--write-sub', '--sub-langs', 'en', '--convert-subs', 'srt']);
});

test('sub args: manual language, embedded - --embed-subs only', () => {
  assert.deepEqual(svc._subArgs(subJob({}), 'embedded'),
    ['--embed-subs', '--sub-langs', 'en', '--convert-subs', 'srt']);
});

test('sub args: auto-only language - --write-auto-subs, never --write-sub', () => {
  const args = svc._subArgs(subJob({ subLangs: [], subAutoLangs: ['en'] }), 'separate');
  assert.ok(args.includes('--write-auto-subs'));
  assert.ok(!args.includes('--write-sub'));
  assert.ok(!args.includes('--embed-subs'));
});

test('sub args: auto-only language, embedded mode - the written auto caption is embedded', () => {
  const args = svc._subArgs(subJob({ subLangs: [], subAutoLangs: ['en'] }), 'embedded');
  assert.ok(args.includes('--write-auto-subs'));
  assert.ok(args.includes('--embed-subs'));
  assert.ok(!args.includes('--write-sub'));
});

test('sub args: a language in both lists prefers the manual track', () => {
  const args = svc._subArgs(subJob({ subLangs: ['en'], subAutoLangs: ['en'] }), 'separate');
  assert.ok(args.includes('--write-sub'));
  assert.ok(!args.includes('--write-auto-subs'));
});

test('sub args: no language lists on the job - manual behaviour, as before', () => {
  assert.deepEqual(svc._subArgs({ kind: 'video', subLang: 'fa' }, 'separate'),
    ['--write-sub', '--sub-langs', 'fa', '--convert-subs', 'srt']);
});

test('sub args: disabled mode, missing language and image jobs get no subtitle args', () => {
  assert.deepEqual(svc._subArgs(subJob({}), 'disabled'), []);
  assert.deepEqual(svc._subArgs(subJob({ subLang: '' }), 'separate'), []);
  assert.deepEqual(svc._subArgs(subJob({ kind: 'image' }), 'separate'), []);
});

test('ffmpeg detection: absent vendor dir means no ffmpeg, version lookup tolerated', async () => {
  assert.equal(svc.hasFfmpeg(), false);
  // binPath falls back to a PATH lookup name instead of throwing
  assert.equal(typeof svc.binPath(), 'string');
});
