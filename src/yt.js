'use strict';
/**
 * KamanTube - yt-dlp service (search / info / playlist / download queue).
 * Talks to the bundled yt-dlp.exe; every HTTP call optionally goes through
 * the local Aether SOCKS5 proxy.
 */
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { EventEmitter } = require('events');

class YtdlpService extends EventEmitter {
  constructor(vendorDir) {
    super();
    this.vendorDir = vendorDir;
    this._bin = null;
    this._ffmpeg = null;
    this._jobs = new Map(); // id -> child process
  }

  binPath() {
    if (this._bin && fs.existsSync(this._bin)) return this._bin;
    const candidates = [
      path.join(this.vendorDir, 'yt-dlp', 'yt-dlp.exe'),
      path.join(this.vendorDir, 'yt-dlp.exe'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) { this._bin = c; return c; }
    }
    return 'yt-dlp.exe'; // hope it is on PATH (dev runs)
  }

  ffmpegDir() {
    if (this._ffmpeg) return this._ffmpeg;
    const d = path.join(this.vendorDir, 'ffmpeg');
    if (fs.existsSync(path.join(d, 'ffmpeg.exe'))) { this._ffmpeg = d; return d; }
    return null;
  }

  _exec(args, timeoutMs) {
    return new Promise((resolve, reject) => {
      execFile(this.binPath(), args, {
        windowsHide: true,
        maxBuffer: 256 * 1024 * 1024,
        timeout: timeoutMs || 120000,
      }, (err, stdout, stderr) => {
        const out = String(stdout || '').trim();
        // yt-dlp prints a literal `null` on some failures
        if (err || !out || out === 'null' || out.toLowerCase().startsWith('error:')) {
          const msg = (out && out.startsWith('ERROR:') ? out : stderr || err?.message || 'yt-dlp failed').slice(0, 300);
          return reject(new Error(msg));
        }
        resolve(out);
      });
    });
  }

  _commonArgs(proxy, extra, opts) {
    return [
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      ...(extra || []),
      ...(proxy ? ['--proxy', proxy] : []),
      // Optional, explicit user opt-in only: use the signed-in session from
      // the user's own browser or their own cookies.txt file (account
      // access). The app never asks for or stores a password; cookie
      // values are never logged.
      ...(opts && opts.cookiesFile ? ['--cookies', String(opts.cookiesFile)] : []),
      ...(opts && opts.cookiesBrowser ? ['--cookies-from-browser', String(opts.cookiesBrowser)] : []),
    ];
  }

  /* -------------------------------------------------------------- search */

  async search(query, proxy) {
    const args = this._commonArgs(proxy, [
      '--dump-json',
      '--flat-playlist',
      `ytsearch20:${query}`,
    ]);
    const stdout = await this._exec(args, 60000);
    return stdout.split('\n')
      .filter((l) => l.trim().startsWith('{'))
      .map((l) => {
        try { return JSON.parse(l); } catch (_) { return null; }
      })
      .filter((o) => o && (o.type === 'video' || o.type === 'playlist' || !o.type))
      .map((o) => {
        const isPlaylist = o.type === 'playlist';
        return {
          id: o.id,
          url: (o.url && o.url.startsWith('http')) ? o.url : `https://www.youtube.com/watch?v=${o.id}`,
          title: o.title || '',
          uploader: o.uploader || o.channel || '',
          duration: o.duration || 0,
          thumb: o.thumbnail || o.thumbnails?.[o.thumbnails?.length - 1]?.url || '',
          views: o.view_count || 0,
          type: isPlaylist ? 'playlist' : 'video',
          isPlaylist,
          count: isPlaylist ? o.playlist_count || o.n_entries || 0 : 0,
        };
      });
  }

  /* ------------------------------------------------------ video info ---- */

  async info(url, proxy, opts) {
    const args = this._commonArgs(proxy, ['--dump-single-json', url], opts);
    const stdout = await this._exec(args, 90000);
    const o = JSON.parse(stdout);
    if (o._type === 'playlist' && o.entries) {
      return this._playlistShape(o);
    }
    return this._videoShape(o, url);
  }

  async playlist(url, proxy, opts) {
    const args = this._commonArgs(proxy, ['--dump-single-json', '--flat-playlist', url], opts);
    const stdout = await this._exec(args, 120000);
    const o = JSON.parse(stdout);
    return this._playlistShape(o);
  }

  _playlistShape(o) {
    return {
      type: 'playlist',
      title: o.title || '',
      url: o.webpage_url || o.original_url || '',
      uploader: o.uploader || o.channel || '',
      entries: (o.entries || []).filter(Boolean).map((e, i) => ({
        idx: i,
        id: e.id,
        url: e.url && e.url.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.id}`,
        title: e.title || '',
        uploader: e.uploader || e.channel || o.uploader || '',
        duration: e.duration || 0,
        thumb: e.thumbnail || e.thumbnails?.[e.thumbnails?.length - 1]?.url || '',
        views: e.view_count || 0,
      })),
    };
  }

  /** Normalise a yt-dlp subtitle map ({ lang: [tracks] }) to [{lang, name}]. */
  _subList(map) {
    return Object.entries(map || {})
      .filter(([, tracks]) => Array.isArray(tracks) && tracks.length)
      .map(([lang]) => {
        try {
          const r = new Intl.DisplayNames(['fa'], { type: 'language' });
          return { lang, name: r.of(lang) || lang };
        } catch (_) { return { lang, name: lang }; }
      });
  }

  /**
   * Subtitle arguments for a download job. A requested language the video
   * only has as an auto-generated caption (listed in job.subAutoLangs and
   * not in job.subLangs) is fetched with --write-auto-subs; an embedded
   * auto caption is still embedded after being written. Every other case
   * keeps the manual behaviour: --embed-subs soft-embedded into the
   * container, or --write-sub as a separate file. A job carrying no
   * language lists at all is treated as manual, exactly as before.
   */
  _subArgs(job, subsMode) {
    if (job.kind === 'image' || !job.subLang || subsMode === 'disabled') return [];
    const manual = Array.isArray(job.subLangs) && job.subLangs.includes(job.subLang);
    const autoOnly = !manual
      && Array.isArray(job.subAutoLangs) && job.subAutoLangs.includes(job.subLang);
    const out = ['--sub-langs', job.subLang, '--convert-subs', 'srt'];
    if (autoOnly) {
      out.unshift('--write-auto-subs');
      if (subsMode === 'embedded') out.push('--embed-subs');
      return out;
    }
    out.unshift(subsMode === 'separate' ? '--write-sub' : '--embed-subs');
    return out;
  }

  _videoShape(o, url) {
    const allFormats = o.formats || [];
    const formats = allFormats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height);

    // Image-only media (e.g. a Pinterest image pin): no video streams,
    // but a downloadable image format exists.
    if (!formats.length) {
      const img = allFormats.find((f) => (!f.vcodec || f.vcodec === 'none')
        && (!f.acodec || f.acodec === 'none')
        && /^(jpe?g|png|webp|gif|avif)$/i.test(f.ext || ''));
      if (img) {
        return {
          type: 'image',
          id: o.id,
          url: o.webpage_url || o.original_url || '',
          title: o.title || '',
          uploader: o.uploader || o.channel || '',
          views: o.view_count || 0,
          duration: 0,
          thumb: o.thumbnail || img.url || '',
          uploadDate: o.upload_date || '',
          description: (o.description || '').slice(0, 1200),
          subtitles: [],
          autoSubtitles: [],
          qualities: [],
          audio: null,
          image: {
            formatId: img.format_id, ext: img.ext || 'jpg',
            width: img.width || 0, height: img.height || 0,
            size: img.filesize || img.filesize_approx || 0,
          },
        };
      }
    }

    // best variant per height: prefer muxed (has audio), then highest bitrate
    const byHeight = {};
    for (const f of formats) {
      const h = f.height;
      const muxed = f.acodec && f.acodec !== 'none';
      const score = (muxed ? 1e6 : 0) + (f.tbr || f.fps || 0);
      const cur = byHeight[h];
      if (!cur || score > cur._s) { f._s = score; byHeight[h] = f; }
    }
    const heights = Object.keys(byHeight).map(Number).sort((a, b) => b - a);
    const qualities = heights.slice(0, 8).map((h) => {
      const f = byHeight[h];
      return {
        formatId: f.format_id,
        height: h,
        fps: f.fps || 30,
        ext: f.video_ext || 'mp4',
        size: f.filesize || f.filesize_approx || 0,
        hdr: (f.dynamic_range || 'SDR') !== 'SDR',
      };
    });

    const audioFormats = (o.formats || []).filter((f) => f.acodec && f.acodec !== 'none'
      && (!f.vcodec || f.vcodec === 'none'));
    let bestAudio = null;
    for (const f of audioFormats) {
      const score = (f.abr || f.tbr || 0) + (f.filesize ? -1 : 0);
      if (!bestAudio || score > bestAudio._s) { f._s = score; bestAudio = f; }
    }

    // Real available subtitles (language + human name). Manual tracks and
    // auto-generated captions are separate lists; a language present in
    // both stays manual-only, because the manual track is the real one.
    const subtitles = this._subList(o.subtitles);
    const manualLangs = new Set(subtitles.map((s) => s.lang));
    const autoSubtitles = this._subList(o.automatic_captions)
      .filter((s) => !manualLangs.has(s.lang));

    return {
      type: 'video',
      id: o.id,
      url: o.webpage_url || o.original_url || url,
      title: o.title || '',
      uploader: o.uploader || o.channel || '',
      views: o.view_count || 0,
      duration: o.duration || 0,
      thumb: o.thumbnail || o.thumbnails?.[o.thumbnails?.length - 1]?.url || '',
      uploadDate: o.upload_date || '',
      description: (o.description || '').slice(0, 1200),
      subtitles,
      autoSubtitles,
      qualities,
      audio: bestAudio && {
        formatId: bestAudio.format_id,
        abr: bestAudio.abr || Math.round(bestAudio.tbr || 0),
        ext: bestAudio.ext || 'm4a',
        size: bestAudio.filesize || bestAudio.filesize_approx || 0,
      },
    };
  }

  /* ------------------------------------------------------------ download */

  async download(job, proxy) {
    const outDir = job.outDir || process.env.USERPROFILE;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const isAudio = job.kind === 'audio';
    // Subtitle / thumbnail placement modes: 'embedded' | 'separate' | 'disabled'.
    // Legacy flags (embedSubs / embedThumb / separateFiles) still honoured.
    const subsMode = job.subsMode
      || (job.separateFiles ? 'separate' : (job.embedSubs === false ? 'disabled' : 'embedded'));
    const thumbMode = job.thumbMode
      || (job.separateFiles ? 'separate' : (job.embedThumb === false ? 'disabled' : 'embedded'));
    const args = [
      '--no-warnings',
      '--newline',
      '--no-playlist',
      '--continue',
      '--merge-output-format', 'mp4',
      '-o', path.join(outDir, '%(title)s [%(id)s].%(ext)s'),
      ...(this.ffmpegDir() ? ['--ffmpeg-location', this.ffmpegDir()] : []),
      ...(proxy ? ['--proxy', proxy] : []),
      ...(job.rateLimitKb && job.rateLimitKb > 0 ? ['--limit-rate', `${job.rateLimitKb}K`] : []),
      ...(job.cookiesFile ? ['--cookies', String(job.cookiesFile)] : []),
      ...(job.cookiesBrowser ? ['--cookies-from-browser', String(job.cookiesBrowser)] : []),
    ];

    if (job.kind === 'image') {
      args.push('-f', job.formatId && job.formatId !== 'best' ? String(job.formatId) : 'best');
    } else if (isAudio) {
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extract-audio', '--audio-format', 'm4a',
        '--audio-quality', '0', '-x');
    } else if (job.formatId && job.formatId !== 'best') {
      // download selected video+top audio and merge
      args.push('-f', `${job.formatId}+bestaudio[ext=m4a]/${job.formatId}+bestaudio/best`);
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
    }

    // Subtitles: embedded into the container, a separate .srt, or skipped;
    // auto-generated captions go through --write-auto-subs (see _subArgs).
    args.push(...this._subArgs(job, subsMode));
    // Thumbnail: embedded into the media file or saved next to it.
    if (job.kind === 'image') {
      // the file IS the image - no thumbnail handling
    } else if (thumbMode === 'separate') {
      args.push('--write-thumbnail');
    } else if (thumbMode === 'embedded') {
      args.push('--embed-thumbnail');
    }
    args.push(job.url);

    const id = job.id || `j${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const child = spawn(this.binPath(), args, { windowsHide: true });
    this._jobs.set(id, child);
    // if the connection dies, yt-dlp can hang silently - kill it so the
    // queue keeps moving and the tunnel watchdog can reconnect.
    let lastActivity = Date.now();
    const hangWatch = setInterval(() => {
      if (Date.now() - lastActivity > 180000) {
        clearInterval(hangWatch);
        this._jobs.delete(id);
        const { spawn: sp } = require('child_process');
        try { sp('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); } catch (_) { child.kill('SIGTERM'); }
        send({ type: 'error', message: 'download stalled (no progress for 3 min) - tunnel reconnecting' });
      }
    }, 30000);
    child.once('exit', () => clearInterval(hangWatch));

    const send = (e) => this.emit('event', { id, ...e, url: job.url, title: job.title });

    send({ type: 'start' });

    let lastPct = -1;
    child.stdout.on('data', (chunk) => {
      lastActivity = Date.now();
      for (const line of chunk.toString().split('\n')) {
        const m = /\[download\]\s+([\d.]+)% of\s+~?\s*([\d.]+)(KiB|MiB|GiB) at\s+([\d.]+)(KiB|MiB|GiB)\/s ETA (\d+):(\d+)/.exec(line)
          || /\[download\]\s+([\d.]+)% of\s+~?\s*([\d.]+)(KiB|MiB|GiB) at\s+([\d.]+)(KiB|MiB|GiB)\/s/.exec(line);
        if (m) {
          const units = { KiB: 1, MiB: 1024, GiB: 1024 * 1024 };
          const pct = parseFloat(m[1]);
          if (pct !== lastPct) {
            lastPct = pct;
            // m[2] is the TOTAL size ("x% of ~SIZE"); downloaded derives from pct.
            const totalKb = (parseFloat(m[2]) || 0) * units[m[3]];
            send({
              type: 'progress',
              pct,
              downloaded: totalKb * (pct / 100),
              total: totalKb,
              speed: (parseFloat(m[4]) || 0) * units[m[5]],
              eta: m[6] ? `${m[6]}:${m[7]}` : '',
            });
          }
        } else if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
          send({ type: 'merging', message: 'merging' });
        }
      }
    });

    let lastError = '';
    child.stderr.on('data', (chunk) => {
      lastActivity = Date.now();
      const t = chunk.toString();
      for (const line of t.split('\n')) {
        if (/ERROR/i.test(line)) lastError = line.trim().slice(0, 240);
      }
      if (t.trim()) send({ type: 'log', message: t.trim().slice(0, 300) });
    });

    child.on('close', (code) => {
      this._jobs.delete(id);
      if (code === 0) send({ type: 'done', title: job.title });
      else send({ type: 'error', message: lastError || `exited with code ${code}` });
    });

    return id;
  }

  /** yt-dlp version string for Diagnostics / Settings, or null. */
  version() {
    return new Promise((resolve) => {
      execFile(this.binPath(), ['--version'], { windowsHide: true, timeout: 15000 },
        (err, stdout) => resolve(err ? null : String(stdout || '').trim() || null));
    });
  }

  /** Whether the bundled ffmpeg is available (merge / embed steps). */
  hasFfmpeg() { return !!this.ffmpegDir(); }

  cancel(id) {
    const c = this._jobs.get(id);
    if (c) {
      const { spawn: sp } = require('child_process');
      try { sp('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true }); } catch (_) { c.kill('SIGTERM'); }
      this._jobs.delete(id);
      this.emit('event', { id, type: 'canceled' });
    }
  }
}

module.exports = { YtdlpService };
