'use strict';
/**
 * KamanTube - TunnelManager
 *
 * Automatic censorship-circumvention orchestration around the Aether core
 * (https://github.com/CluvexStudio/Aether). Everything happens silently in
 * the background - the user never configures anything.
 *
 * Behaviour contract:
 *  1. Detect the user's public IP / country (shown in the UI).
 *  2. The tunnel is only brought up when the IP is from a blocked country
 *     (default: Iran). Otherwise traffic goes direct.
 *  3. First connection tries MASQUE over HTTP/2 (--h2) first, then HTTP/3,
 *     then WireGuard, then gool. Every attempt is verified end-to-end
 *     through the SOCKS5 proxy, not just by port availability.
 *  4. The WARP identity (key) is obtained automatically by Aether on first
 *     registration and kept in the app data folder. It is NEVER deleted
 *     while it works.
 *  5. The last working recipe (protocol + endpoint) is cached. Next run
 *     reuses it directly (--quick-reconnect). A fresh key + full scan
 *     happens only when the cached recipe stops working, or when
 *     Cloudflare refuses the stored identity.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const net = require('net');

const state = require('./state');

const BLOCKED_COUNTRIES = state.get('blockedCountries', ['IR']);
const PORT_BASE = 1819;

/* Protocol attempts, in required order: MASQUE h2 first, then the rest. */
const ATTEMPTS = [
  { id: 'masque-h2', args: ['--masque', '--h2'], label: 'MASQUE · HTTP/2' },
  { id: 'masque-h3', args: ['--masque'], label: 'MASQUE · HTTP/3' },
  { id: 'wg', args: ['--wg'], label: 'WireGuard' },
  { id: 'gool', args: ['--gool'], label: 'WireGuard over MASQUE' },
];

function curlExe() {
  return 'curl.exe';
}

function runCurl(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(curlExe(), args, { windowsHide: true, timeout: timeoutMs },
      (err, stdout) => resolve(err ? null : String(stdout || '').trim()));
  });
}

/** Simple HTTP-GET that returns the body text or null. */
async function httpGet(url, timeoutMs, proxy) {
  const args = ['-s', '-L', '--max-time', String(Math.ceil(timeoutMs / 1000))];
  if (proxy) args.push('-x', proxy);
  args.push(url);
  const out = (await runCurl(args, timeoutMs + 2000)) || '';
  return out.startsWith('{') || out.includes('\n') || out.length > 0 ? out : null;
}

class TunnelManager extends EventEmitter {
  constructor(vendorDir) {
    super();
    this.vendorDir = vendorDir;
    this.binPath = null;
    this.proc = null;
    this.port = 0;
    this.usingTunnel = false;
    this.isActive = false;
    this.lastIp = null;
    this.lastCountry = null;
    this.exitIp = null;
    this.exitCountry = null;
    this.protocolLabel = null;
    this.recipeKey = null;
    this.ensureRunning = false;
    this._rejecting = false;
    this._lastconnNames = null;
  }

  dataDir() {
    const d = path.join(app_data_dir(), 'aether');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  findBinary() {
    if (this.binPath && fs.existsSync(this.binPath)) return this.binPath;
    const candidates = [
      path.join(this.vendorDir, 'aether', 'aether.exe'),
      path.join(this.vendorDir, 'aether.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) { this.binPath = c; return c; }
    }
    return null;
  }

  /* --------------------------------------------------------- IP detection */

  async detectIp() {
    let trace = await httpGet('https://cloudflare.com/cdn-cgi/trace', 8000);
    if (trace) {
      const info = this._parseTrace(trace);
      if (info.ip) return info;
    }
    const j = await httpGet('https://ipapi.co/json/', 8000);
    if (j) {
      try {
        const o = JSON.parse(j);
        if (o.ip) return { ip: o.ip, country: (o.country_code || '').toUpperCase(), city: o.city || '' };
      } catch (_) { /* fallthrough */ }
    }
    const ip = await httpGet('https://api.ipify.org?format=json', 8000);
    if (ip) {
      try { return { ip: JSON.parse(ip).ip, country: null }; } catch (_) { /* none */ }
    }
    return null;
  }

  _parseTrace(t) {
    const kv = {};
    for (const line of t.split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) kv[line.slice(0, i)] = line.slice(i + 1);
    }
    return { ip: kv.ip || null, country: (kv.loc || '').toUpperCase(), city: kv.city || kv.colocode || '' };
  }

  /* ------------------------------------------------------------- lifecycle */

  emitStatus(extra) {
    const s = {
      state: this.isActive
        ? (this.usingTunnel ? 'tunnel' : 'direct')
        : 'checking',
      ip: this.lastIp,
      country: this.lastCountry,
      exitIp: this.exitIp,
      exitCountry: this.exitCountry,
      usingTunnel: this.usingTunnel,
      protocol: this.protocolLabel,
      recipe: this.recipeKey,
      port: this.port,
      ...extra,
    };
    this.emit('status', s);
  }

  proxyUrl() {
    return this.usingTunnel && this.port ? `socks5h://127.0.0.1:${this.port}` : '';
  }

  stop() {
    this._killProc();
    this.isActive = false;
    this.usingTunnel = false;
    this.emitStatus();
  }

  _killProc() {
    const p = this.proc;
    if (!p || p.exitCode !== null) { this.proc = null; return; }
    try {
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true });
      } else {
        p.kill('SIGTERM');
      }
    } catch (_) { /* ignore */ }
    this.proc = null;
  }

  freePort() {
    for (let port = PORT_BASE; port <= PORT_BASE + 12; port++) {
      if (!this._portInUse(port)) return port;
    }
    return PORT_BASE;
  }

  /** True when something already listens on the port (connect probe). */
  _portInUse(port) {
    return new Promise((resolve) => {
      const s = net.connect(port, '127.0.0.1');
      const done = (v) => { s.destroy(); resolve(v); };
      s.once('connect', () => done(true));
      s.once('error', () => done(false));
      setTimeout(() => done(false), 1200);
    });
  }

  /**
   * Adopt an already-running Aether (e.g. from a previous app instance or a
   * user-started copy) instead of spawning a competing one.
   */
  async adoptExisting() {
    for (let port = PORT_BASE; port <= PORT_BASE + 12; port++) {
      if (await this._portInUse(port)) {
        const proxy = `socks5h://127.0.0.1:${port}`;
        if (await this.verifyProxy(proxy, 30000)) {
          this.port = port;
          this.proc = null; // not ours to manage
          this.usingTunnel = true;
          this.recipeKey = state.get('tunnelRecipe') || 'adopted';
          this.protocolLabel = 'existing tunnel';
          return true;
        }
      }
    }
    return false;
  }

  /* -------------------------------------------------------- E2E liveness */

  /** Verify traffic actually flows through the SOCKS5 proxy. */
  async verifyProxy(proxy, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const code = (await runCurl(
        ['-s', '-o', 'NUL', '-w', '%{http_code}', '-x', proxy,
          '--max-time', '15', 'https://www.youtube.com/generate_204'],
        20000
      )) || '';
      if (code.trim() === '204') return true;
      await sleep(2000);
    }
    return false;
  }

  /** quick TCP probe - only used to know the local listener is up. */
  _portOpen(port) {
    return new Promise((resolve) => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => resolve(false));
      setTimeout(() => { s.destroy(); resolve(false); }, 1500);
    });
  }

  /* ------------------------------------------------------------ scanning */

  buildArgs(attempt, extra) {
    return [
      ...attempt.args,
      '--noize', 'firewall',
      '--scan', 'balanced',
      '--quick-reconnect',
      '--bind', `127.0.0.1:${this.port}`,
      '--masque-config', path.join(this.dataDir(), 'aether-masque.toml'),
      '--wg-config', path.join(this.dataDir(), 'aether.toml'),
      ...(extra || []),
    ];
  }

  _spawnAttempt(attempt, extra) {
    fs.mkdirSync(this.dataDir(), { recursive: true });
    const args = this.buildArgs(attempt, extra);
    const cwd = this.dataDir();
    this._rejecting = false;
    const proc = spawn(this.binPath, args, { cwd, windowsHide: true });
    proc.stdout.on('data', (d) => this._ingestOutput(d));
    proc.stderr.on('data', (d) => this._ingestOutput(d));
    return proc;
  }

  /** Watch Aether output for the "identity rejected" message. */
  _ingestOutput(d) {
    const text = d.toString();
    if (text.includes('no longer accepts the saved identity')) {
      this._rejecting = true;
      this.emit('log', 'Cloudflare refused the stored WARP key - getting a fresh one…');
    }
  }

  /** Archive (not delete) identity files so a replacement is generated. */
  _archiveIdentity() {
    const dir = this.dataDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dead = path.join(dir, `.dead-${stamp}`);
    fs.mkdirSync(dead, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      if (/^aether.*\.toml$/.test(f)) {
        try { fs.renameSync(path.join(dir, f), path.join(dead, f)); } catch (_) { /* best effort */ }
      }
    }
  }

  async runAttempt(attempt, timeoutMs) {
    this.port = this.freePort();
    const proc = this._spawnAttempt(attempt);
    this.proc = proc;
    let sawPort = false;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(1500);
      if (!sawPort) {
        sawPort = await this._portOpen(this.port);
        if (sawPort) {
          const proxy = `socks5h://127.0.0.1:${this.port}`;
          if (await this.verifyProxy(proxy, 25000)) {
            this.usingTunnel = true;
            this.protocolLabel = attempt.label;
            this.recipeKey = attempt.id;
            return { ok: true, proc, attempt };
          }
          sawPort = false; // port up but no traffic yet; keep polling
        }
      }
      if (this._rejecting) {
        this._killProc();
        this._archiveIdentity();
        this._rejecting = false;
        // give the identity check a pass: try this same attempt again with a
        // brand-new key (registers automatically because files are gone)
        this.emit('log', `Retrying ${attempt.label} with a fresh WARP key…`);
        const proc2 = this._spawnAttempt(attempt);
        this.proc = proc2;
        sawPort = false;
      } else if (proc.exitCode !== null) {
        return { ok: false, error: 'process exited' };
      }
    }
    this._killProc();
    return { ok: false, error: 'timeout' };
  }

  /* --------------------------------------------------------------- ensure */

  async ensure() {
    if (this.ensureRunning) return;
    this.ensureRunning = true;
    try {
      this.emitStatus({ state: 'checking' });

      // 1) who am I / where am I?
      const info = await this.detectIp();
      if (!info) {
        this.isActive = false;
        this.emitStatus({ state: 'offline' });
        return;
      }
      this.lastIp = info.ip;
      this.lastCountry = info.country;
      this.isActive = true;

      // 2) does the network even need help?
      if (!BLOCKED_COUNTRIES.includes(this.lastCountry)) {
        this.usingTunnel = false;
        this.protocolLabel = null;
        this.emitStatus(); // state: 'direct'
        return;
      }

      // 3) tunnel needed - but if a healthy Aether already runs, adopt it
      this.binPath = this.findBinary();
      if (!this.binPath) {
        this.emit('log', 'Aether core missing - cannot open alternate route.');
        this.emitStatus({ state: 'error' });
        return;
      }

      if (await this.adoptExisting()) {
        this.exitIp = this.exitIp || this.lastIp;
        await this._fetchExitIp();
        this.emitStatus(); // state: 'tunnel'
        this.emit('log', 'Adopted an already-running tunnel');
        return;
      }

      const cached = state.get('tunnelRecipe');
      const cachedAttempt = cached && ATTEMPTS.find((a) => a.id === cached);
      const order = cachedAttempt ? [cachedAttempt] : ATTEMPTS;

      this.usingTunnel = false;
      this.emitStatus({ state: 'checking' }); // still direct while trying

      for (const attempt of order) {
        this.emit('log', `Trying ${attempt.label}…`);
        const r = await this.runAttempt(attempt, 120000);
        if (r.ok) {
          state.set('tunnelRecipe', attempt.id);
          await this._fetchExitIp();
          this.emitStatus(); // state: 'tunnel'
          this.emit('log', `Connected via ${attempt.label}`);
          return;
        }
        this.emit('log', `${attempt.label} did not work`);
      }

      // cached attempt failed -> full reshuffle (fresh scan kept for last)
      if (cachedAttempt) {
        for (const attempt of ATTEMPTS) {
          if (attempt.id === cachedAttempt.id) continue;
          this.emit('log', `Trying ${attempt.label}…`);
          const r = await this.runAttempt(attempt, 120000);
          if (r.ok) {
            state.set('tunnelRecipe', attempt.id);
            await this._fetchExitIp();
            this.emitStatus();
            this.emit('log', `Connected via ${attempt.label}`);
            return;
          }
          this.emit('log', `${attempt.label} did not work`);
        }
      }

      this.emitStatus({ state: 'error' });
    } finally {
      this.ensureRunning = false;
    }
  }

  async _fetchExitIp() {
    if (!this.port) return;
    const trace = await httpGet('https://cloudflare.com/cdn-cgi/trace', 12000, this.proxyUrl());
    if (trace) {
      const info = this._parseTrace(trace);
      this.exitIp = info.ip || null;
      this.exitCountry = info.country || null;
    }
  }
}

/* app.getPath('userData') lazily - electron must be ready */
function app_data_dir() {
  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      const d = app.getPath('userData');
      fs.mkdirSync(d, { recursive: true });
      return d;
    }
  } catch (_) { /* not in electron */ }
  const base = path.join(os.homedir(), 'AppData', 'Roaming', 'KamanTube');
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = TunnelManager;
