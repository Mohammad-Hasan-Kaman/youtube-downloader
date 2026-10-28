'use strict';
/** KamanTube - real tunnel test: ensure() on a restricted network. */
const path = require('path');
const TunnelManager = require('../src/tunnel');

const tm = new TunnelManager(path.join(__dirname, '..', 'vendor'));
tm.on('log', (m) => console.log('[log]', m));
tm.on('status', (s) => console.log('[status]', s.state, s.ip, s.country, s.usingTunnel ? `via ${s.protocol}` : ''));

tm.ensure().then(() => {
  console.log('ensure() done. usingTunnel=', tm.usingTunnel, 'protocol=', tm.protocolLabel, 'exitIp=', tm.exitIp, tm.exitCountry);
  if (tm.usingTunnel) {
    const { YtdlpService } = require('../src/yt');
    const yt = new YtdlpService(path.join(__dirname, '..', 'vendor'));
    yt.info('https://www.youtube.com/watch?v=BaW_jenozKc', tm.proxyUrl())
      .then((info) => { console.log('INFO THROUGH TUNNEL OK:', info.title); process.exit(0); })
      .catch((e) => { console.error('INFO THROUGH TUNNEL FAILED:', e.message); process.exit(1); });
  } else {
    console.log('NO TUNNEL - cannot verify');
    process.exit(1);
  }
}).catch((e) => { console.error('ensure error:', e); process.exit(1); });
