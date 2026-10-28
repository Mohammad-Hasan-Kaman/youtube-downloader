# KamanTube

A modern, fast YouTube downloader for Windows with **automatic censorship
bypass** — everything happens silently in the background.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-blue)

## Highlights

- **Beautiful dark UI** — search YouTube inside the app, browse results as cards,
  preview videos with cover art, and pick quality from smart quality cards
  (with real file sizes) instead of combo boxes.
- **Search built in** — type any keyword, get results instantly, plus full
  support for **playlists and channels** (select all, add everything to the
  download queue with one click).
- **Download queue** — queue as many videos as you like; KamanTube runs two
  downloads concurrently and shows live progress, speed and ETA per item.
- **Video, audio, subtitles, thumbnail** — MP4 merges (max quality),
  audio-only M4A extraction, optional subtitles and thumbnail.
- **No user configuration** — network restrictions are detected and handled
  completely automatically. You never touch a single setting.

## Automatic censorship bypass (powered by [Aether](https://github.com/CluvexStudio/Aether))

KamanTube embeds the Aether userspace WARP core (MASQUE over HTTP/2 & HTTP/3,
WireGuard) and orchestrates it for you:

1. The app detects your public IP and country and **shows it to you** in the
   top bar.
2. If (and only if) your IP is in a restricted country (e.g. Iran), a local
   tunnel is spun up automatically — no user input, ever.
3. **Protocol order:** the first connection tests **MASQUE over HTTP/2**
   (`--h2`, TCP 443) first, then MASQUE/HTTP-3, then WireGuard, then WireGuard
   over MASQUE. Every attempt is verified *end-to-end* through the SOCKS5
   proxy — a protocol only counts when real traffic flows through it.
4. **The WARP key is managed for you.** The app keeps the WARP identity files
   in its data folder and never deletes them while they still work; a fresh
   key is obtained (and the endpoint re-scanned) only when the stored identity
   is refused or a connection stops carrying traffic.
5. **Working configs are cached.** The last working protocol/endpoint recipe
   is remembered and reused on the next start (`--quick-reconnect`) — a full
   re-scan happens only when it is actually broken.

If your network has no restrictions, downloads go **direct** — the tunnel is
never started.

## Install

Grab the latest installer or portable `.exe` from the
[**Releases**](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases)
page.

- `KamanTube-Setup-*.exe` — installer
- `KamanTube-*-portable.exe` — single portable executable

All required runtime binaries (Aether core, yt-dlp, ffmpeg) ship **inside**
the build, so it works out of the box.

## Build from source

```bat
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube-downloader
build.bat
```

Output lands in `dist_out\`.

## Tech stack

- [Electron](https://www.electronjs.org/) + custom CSS (dark glass UI, RTL-first)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for search/extract/download
- [Aether](https://github.com/CluvexStudio/Aether) for automatic circumvention
- ffmpeg for merging / audio extraction

## Privacy

KamanTube collects nothing. Your IP is only fetched to *show it to you* and to
decide whether the tunnel is needed. History and queue live locally.

## License

MIT — see [LICENSE](LICENSE). Aether is AGPL-3.0 and yt-dlp is Unlicense;
both ship as separate executables.
