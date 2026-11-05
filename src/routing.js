'use strict';
/**
 * KamanTube - SmartRoutingManager.
 *
 * The connection layer of the Universal Download Engine. It owns every
 * routing decision so the download engine never talks to Aether
 * internals directly:
 *
 *   - detect the public IP and its country (multiple providers, timeouts)
 *   - decide per destination: direct vs. alternate route
 *   - start the Aether core ONLY for Iranian IPs in automatic mode
 *   - protocol order: MASQUE over HTTP/2 first, then HTTP/3, then
 *     WireGuard variants; every attempt verified end-to-end
 *   - keep the WARP identity while it works; re-register only when refused
 *   - cache the last working recipe and reuse it (quick reconnect)
 *   - health monitoring and recovery without ever blocking the UI
 *
 * The implementation is the TunnelManager that shipped in KamanTube
 * v2.x and was validated on real Iranian networks; it is exposed under
 * its architectural name here. Credentials live in the app data folder,
 * are never logged, and the Aether binary runs unmodified as a separate
 * process (AGPL-3.0, see THIRD_PARTY_NOTICES.md).
 */
const SmartRoutingManager = require('./tunnel');

module.exports = { SmartRoutingManager };
