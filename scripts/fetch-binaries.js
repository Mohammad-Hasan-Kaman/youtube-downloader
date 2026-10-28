'use strict';
/**
 * KamanTube - fetch runtime binaries into ./vendor for packaging.
 * Downloads:
 *   vendor/aether/aether.exe   (Aether core - censorship bypass)
 *   vendor/yt-dlp/yt-dlp.exe   (yt-dlp)
 *   vendor/ffmpeg/ffmpeg.exe, ffprobe.exe (merging)
 * Run: node scripts/fetch-binaries.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');

function dl(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log('downloading', url);
  execFileSync('curl.exe', ['-sSL', '--retry', '3', '--max-time', '600', '-o', dest, url], { stdio: 'inherit' });
}

async function ghAsset(repo, asset) {
  // resolve latest release asset URL via GitHub API
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': 'KamanTube' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`);
  const rel = await res.json();
  const a = rel.assets.find((x) => x.name === asset);
  if (!a) throw new Error(`asset ${asset} not found in ${repo} latest`);
  return a.browser_download_url;
}

function unzip(src, extractTo, filter) {
  // PowerShell's Expand-Archive handles zip reliably on Windows
  execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath "${src}" -DestinationPath "${extractTo}" -Force`,
  ], { windowsHide: true });
  if (filter) {
    // keep only matching files
    for (const f of fs.readdirSync(extractTo)) {
      const full = path.join(extractTo, f);
      if (!filter(f)) fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

async function main() {
  const vendor = path.join(__dirname, '..', 'vendor');
  const tmp = path.join(__dirname, '..', '.tmp-vendor');
  fs.mkdirSync(vendor, { recursive: true });
  fs.mkdirSync(tmp, { recursive: true });

  // 1) Aether
  const aetherUrl = await ghAsset('CluvexStudio/Aether', 'aether-windows-x86_64.zip');
  const az = path.join(tmp, 'aether.zip');
  dl(aetherUrl, az);
  unzip(az, tmp);
  fs.mkdirSync(path.join(vendor, 'aether'), { recursive: true });
  fs.copyFileSync(path.join(tmp, 'aether.exe'), path.join(vendor, 'aether', 'aether.exe'));
  console.log('aether ok');

  // 2) yt-dlp
  const ydlUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  dl(ydlUrl, path.join(vendor, 'yt-dlp', 'yt-dlp.exe'));
  console.log('yt-dlp ok');

  // 3) ffmpeg essentials (just the two exe files) - asset names are versioned,
  //    so pick the one matching ..._essentials_build.zip from the latest release
  const ffRepo = 'GyanD/codexffmpeg';
  const res = await fetch(`https://api.github.com/repos/${ffRepo}/releases/latest`, { headers: { 'User-Agent': 'KamanTube' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${ffRepo}`);
  const rl = await res.json();
  const ffA = rl.assets.find((x) => /essentials_build\.zip$/.test(x.name));
  if (!ffA) throw new Error(`essentials_build.zip not found in ${ffRepo} latest`);
  const ffUrl = ffA.browser_download_url;
  const fz = path.join(tmp, 'ffmpeg.zip');
  dl(ffUrl, fz);
  const ffDir = path.join(tmp, 'ffmpeg-x');
  unzip(fz, ffDir);
  const inner = fs.readdirSync(ffDir).find((d) => fs.statSync(path.join(ffDir, d)).isDirectory());
  fs.mkdirSync(path.join(vendor, 'ffmpeg'), { recursive: true });
  for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
    fs.copyFileSync(path.join(ffDir, inner, 'bin', exe), path.join(vendor, 'ffmpeg', exe));
  }
  console.log('ffmpeg ok');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ALL BINARIES READY');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
