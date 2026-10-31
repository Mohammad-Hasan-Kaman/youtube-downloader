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

  _commonArgs(proxy, extra) {
    return [
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      ...(extra || []),
      ...(proxy ? ['--proxy', proxy] : []),
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

  async info(url, proxy) {
    const args = this._commonArgs(proxy, ['--dump-single-json', url]);
    const stdout = await this._exec(args, 90000);
    const o = JSON.parse(stdout);
    if (o._type === 'playlist' && o.entries) {
      return this._playlistShape(o);
    }
    return this._videoShape(o);
  }

  async playlist(url, proxy) {
    const args = this._commonArgs(proxy, ['--dump-single-json', '--flat-playlist', url]);
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

  _videoShape(o) {
    const formats = (o.formats || []).filter((f) => f.vcodec && f.vcodec !== 'none' && f.height);

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

    // real available subtitles (language + human name)
    const subMap = o.subtitles || {};
    const subtitles = Object.entries(subMap)
      .filter(([, tracks]) => Array.isArray(tracks) && tracks.length)
      .map(([lang]) => {
        try {
          const r = new Intl.DisplayNames(['fa'], { type: 'language' });
          return { lang, name: r.of(lang) || lang };
        } catch (_) { return { lang, name: lang }; }
      });

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
    const embedSubs = job.embedSubs !== false;    // default: embedded into the video
    const embedThumb = job.embedThumb !== false;  // default: embedded into the video
    const separate = !!job.separateFiles;         // optional: keep extra files
    const args = [
      '--no-warnings',
      '--newline',
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '-o', path.join(outDir, '%(title)s [%(id)s].%(ext)s'),
      ...(this.ffmpegDir() ? ['--ffmpeg-location', this.ffmpegDir()] : []),
      ...(proxy ? ['--proxy', proxy] : []),
    ];

    if (isAudio) {
      args.push('-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extract-audio', '--audio-format', 'm4a',
        '--audio-quality', '0', '-x');
    } else if (job.formatId && job.formatId !== 'best') {
      // download selected video+top audio and merge
      args.push('-f', `${job.formatId}+bestaudio[ext=m4a]/${job.formatId}+bestaudio/best`);
    } else {
      args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best');
    }

    // Subtitles: embed into the file by default; separate .srt only if requested.
    if (job.subLang) {
      if (separate) {
        args.push('--write-sub', '--sub-langs', job.subLang, '--convert-subs', 'srt');
      } else if (embedSubs) {
        args.push('--embed-subs', '--sub-langs', job.subLang, '--convert-subs', 'srt');
      }
    }
    // Thumbnail: embed into the file by default; separate file only if requested.
    if (job.thumbnail) {
      if (separate) {
        args.push('--write-thumbnail');
      } else if (embedThumb) {
        args.push('--embed-thumbnail');
      }
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
            send({
              type: 'progress',
              pct,
              downloaded: (parseFloat(m[2]) || 0) * units[m[3]],
              total: pct > 0 ? (parseFloat(m[2]) || 0) * units[m[3]] / (pct / 100) : 0,
              speed: (parseFloat(m[4]) || 0) * units[m[5]],
              eta: m[6] ? `${m[6]}:${m[7]}` : '',
            });
          }
        } else if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
          send({ type: 'merging', message: 'merging' });
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      lastActivity = Date.now();
      const t = chunk.toString();
      if (t.trim()) send({ type: 'log', message: t.trim().slice(0, 300) });
    });

    child.on('close', (code) => {
      this._jobs.delete(id);
      if (code === 0) send({ type: 'done', title: job.title });
      else send({ type: 'error', message: `exited with code ${code}` });
    });

    return id;
  }

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
