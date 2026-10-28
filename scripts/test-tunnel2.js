'use strict';
/** KamanTube - tunnel test v2: keep aether alive, trace exit, info through tunnel. */
const path = require('path');
const TunnelManager = require('../src/tunnel');
const net = require('net');

const tm = new TunnelManager(path.join(__dirname, '..', 'vendor'));
tm.on('log', (m) => console.log('[log]', m));
tm.on('status', (s) => console.log('[status]', s.state, s.ip, s.country, s.usingTunnel ? `via ${s.protocol} port ${s.port}` : ''));

const portProbe = (p) => new Promise((res) => {
  const s = net.connect(p, '127.0.0.1');
  s.once('connect', () => { s.destroy(); res('OPEN'); });
  s.once('error', (e) => res('REFUSED ' + e.code));
  setTimeout(() => { s.destroy(); res('TIMEOUT'); }, 2000);
});

tm.ensure().then(async () => {
  console.log('ensure done. usingTunnel=', tm.usingTunnel, 'protocol=', tm.protocolLabel);
  const proc = tm.proc;
  console.log('aether pid=', proc && proc.pid, 'exitCode=', proc && proc.exitCode);
  if (proc) proc.on('close', (c, sig) => console.log('[aether closed]', c, sig));
  for (let i = 0; i < 6; i++) {
    console.log('probe port', tm.port, '=>', await portProbe(tm.port));
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('proxyUrl:', tm.proxyUrl());
  const { YtdlpService } = require('../src/yt');
  const yt = new YtdlpService(path.join(__dirname, '..', 'vendor'));
  try {
    const info = await yt.info('https://www.youtube.com/watch?v=BaW_jenozKc', tm.proxyUrl());
    console.log('INFO THROUGH TUNNEL OK:', info.title);
    console.log('qualities:', info.qualities && info.qualities.map((q) => q.height + 'p').join(','));
    process.exit(0);
  } catch (e) {
    console.error('INFO FAILED:', e.message);
    process.exit(1);
  }
}).catch((e) => { console.error('ensure error:', e); process.exit(1); });
