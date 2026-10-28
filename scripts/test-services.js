'use strict';
/**
 * KamanTube - headless service test (no electron).
 * Verifies: yt-dlp search/info and tunnel detectIp. Run:
 *   node scripts/test-services.js
 */
const TunnelManager = require('../src/tunnel');
const { YtdlpService } = require('../src/yt');
const path = require('path');

async function main() {
  const vendor = path.join(__dirname, '..', 'vendor');
  const tm = new TunnelManager(vendor);
  tm.on('status', (s) => console.log('[tunnel]', s.state, s.country, s.usingTunnel ? `via ${s.protocol}` : ''));
  await tm.ensure();
  const proxy = tm.proxyUrl();
  console.log('proxy:', proxy || '(direct)');

  const yt = new YtdlpService(vendor);

  console.log('== yt-dlp search test ==');
  const t0 = Date.now();
  const results = await yt.search('hamed vafaei billiards', proxy);
  console.log(`search ok: ${results.length} results in ${Date.now() - t0}ms`);

  console.log('== yt-dlp info test ==');
  const t1 = Date.now();
  let info = null;
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    results[0] && results[0].url,
    results[1] && results[1].url]) {
    if (!url) continue;
    try {
      info = await yt.info(url, proxy);
      if (info.type === 'video') break;
    } catch (e) {
      console.log('skip', url, '=>', e.message.slice(0, 80));
    }
  }
  if (!info) throw new Error('no test video available');
  console.log(`info ok in ${Date.now() - t1}ms`);
  console.log('title:', info.title);
  console.log('qualities:', info.qualities.map((q) => `${q.height}p@${q.fps} ${q.size ? Math.round(q.size / 1048576) + 'MB' : ''}`).join(' | '));
  console.log('audio:', info.audio && `${info.audio.abr}kbps ${info.audio.ext}`);

  const ip = tm.lastIp;
  console.log('ip:', ip, tm.lastCountry, 'exitIp:', tm.exitIp);
  process.exit(0);
}

main().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
