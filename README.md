### 🌐 Telegram: [@mohaka_programmer](https://t.me/mohaka_programmer)
[![Telegram](https://img.shields.io/badge/Telegram-%40mohaka__programmer-2CA5E0?logo=telegram&logoColor=white)](https://t.me/mohaka_programmer)

# KamanTube — Universal Media Downloader

**Your Media. Your Control. Anywhere.**

KamanTube is a desktop downloader for Windows that puts YouTube, Pinterest,
Instagram, TikTok and X behind one interface and one download queue. Paste a
link and the platform is detected automatically; any other site supported by
[yt-dlp](https://github.com/yt-dlp/yt-dlp) works through a generic fallback.

On restricted networks (Iranian IPs), KamanTube can route traffic through the
[Aether](https://github.com/CluvexStudio/Aether) WARP core automatically —
direct connections stay direct, and the choice is made per site, not just
per country.

```text
Platforms   YouTube · Pinterest · Instagram · TikTok · X · any yt-dlp site
Interface   11 sections · 7 languages · dark / light / system themes
Releases    Windows installer only (KamanTube-Setup-<version>.exe)
License     MIT (third-party components keep their own licenses)
```

## Features

- **One queue for every platform** — pause and resume (resumes from the
  partial `.part` file), cancel, retry, a configurable concurrency limit
  (1–5 simultaneous downloads, default 2) and an optional global speed
  limit. The queue and the history survive restarts, and adding the same
  link and quality twice is refused instead of duplicated.
- **Real quality lists** — the qualities shown for a video are the formats
  the site actually offers for that video, with file sizes where known.
- **Subtitles and thumbnails, your choice per download** — subtitles in the
  languages the video itself provides, either embedded into the file or
  saved next to it as a separate `.srt`; the thumbnail embedded, separate,
  or skipped. Defaults live in Settings and can be overridden for every
  single download.
- **Playlists, channels, profiles and boards** — load a whole listing,
  review the entries, and queue all of them or just a selection.
- **In-app YouTube search** — search without leaving the app (20 results,
  videos and playlists). The other platforms offer no public search for the
  download core to read, so the Search page routes you to each platform's
  listing page instead of pretending otherwise.
- **A detail page for every result** — clicking a search result opens that
  content's own page: preview, the real qualities the site offers (the
  "best" option names its actual resolution) and the download options.
- **A section per platform, and every supported site** — the Platforms
  page gives each platform its own space (its link box, capabilities and
  shortcuts), and the Supported Sites directory lists everything the
  engine can download from: over 1,700 sites, read live from yt-dlp
  itself rather than copied from a marketing page.
- **Media library** — browse, open and delete the files in your downloads
  folder from inside the app.
- **Diagnostics** — your public IP and country, the active routing mode and
  protocol, component versions (app, Electron, yt-dlp, ffmpeg, Aether) and
  a live connection log.

## Platforms

| Platform | What works |
|---|---|
| YouTube | In-app search, videos, playlists, channels, subtitles, all real qualities, audio extraction (M4A) |
| Pinterest | Video pins with real qualities, image pins, boards, profiles |
| Instagram | Public reels, posts and carousels; some content needs your own account session (see below) |
| TikTok | Public videos and profiles, quality selection, audio extraction, images |
| X | Video and image posts, profile media, quality selection, audio extraction |
| Other sites | Anything yt-dlp can extract, via the generic provider; the preview warns that results depend on the site |

## Smart routing (Aether)

KamanTube orchestrates the official Aether core binary — unmodified, as a
separate process — following the same pattern as
[PattN](https://github.com/patterniha/PattN) (see Credits). You never
configure anything:

1. The app detects your public IP and country and shows both to you.
2. In **Auto** mode (default) the tunnel is started **only when your IP is
   Iranian**. On an unrestricted network the tunnel never starts.
   **Forced** starts it regardless; **Direct** disables it.
3. Protocol order is fixed: **MASQUE over HTTP/2 first**, then MASQUE over
   HTTP/3, then WireGuard, then WireGuard over MASQUE. An attempt only
   counts when real traffic verifiably flows through the local SOCKS5
   proxy.
4. **Per-site fallback:** the best route depends on the destination.
   YouTube from Iran needs the tunnel (a direct connection hits a bot
   check), while TikTok geo-blocks the tunnel exit (HTTP 451) and works
   direct. Extraction tries the preferred route first and falls back to
   the other; a download that fails with a geo-block error is retried
   once on the direct route.
5. The **WARP identity is created automatically** by Aether on first run,
   kept in the app data folder, and reused while it works. A fresh
   identity is registered only when the stored one is refused. The last
   working protocol/endpoint recipe is cached for a quick reconnect, the
   tunnel is health-checked in the background, and a dropped tunnel is
   reconnected without blocking the UI. Credentials are never logged.

## Account access (optional, off by default)

Some sites — Instagram most often, YouTube under bot checks — refuse
anonymous extraction. KamanTube's answer is deliberately narrow, in
Settings → Account:

- **Off** (default): only public content, no session is ever read.
- **Browser session:** yt-dlp reads the signed-in session from *your own*
  browser at download time.
- **cookies.txt file:** you point the app at a cookies file you exported
  yourself; the app stores only the file path, never the contents.

The app **never asks for, stores, or logs a password or cookie values**,
and every download preview lets you drop the account for that one download.
If extraction fails with a login/bot-check error while account access is
off, the app says so and points at this setting instead of failing silently.

One practical note: while Chrome is running, its cookie database is locked
and cannot be read — a known yt-dlp limitation, not an app bug. Use another
browser or the cookies.txt option in that case.

## Site blocking

KamanTube ships with a built-in blocklist of adult sites (100+ domains,
subdomains included) that is **always on**; downloads, previews and
playlist loads from those hosts are refused. There is no setting for it:
the filter cannot be switched off or edited from inside the app.
Enforcement happens in the main process, so no screen in the app can
bypass it.

## Languages and themes

- **7 languages, switchable live with no restart:** فارسی (fa), English,
  Deutsch, العربية (ar), Español, Русский, 中文 (zh). Persian and Arabic
  render fully right-to-left; the layout direction flips with the language.
- **Themes:** dark, light, and follow-system. The light theme (warm paper)
  is designed independently, not inverted from the dark one (ink).

## Install

Download `KamanTube-Setup-<version>.exe` from the
[Releases](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases)
page and run it. Releases are **installer-only** — there is no portable or
raw executable — and each release publishes a SHA-256 checksum next to the
installer.

- **Windows 10/11, x64.** The installer is per-user by default, offers a
  Start Menu shortcut and an optional desktop shortcut, and includes an
  uninstaller.
- **SmartScreen:** builds are currently **not code-signed**, so Windows
  SmartScreen shows an "unknown publisher" warning on first run. That is
  expected; verify the SHA-256 checksum against the release page if you
  want to be sure of the file.
- Everything the app needs is bundled: the Aether core, yt-dlp and ffmpeg
  ship inside the installer. No separate downloads, no setup steps.

## Known limitations

- **Instagram without a session is limited.** Profiles and some posts fail
  with "Unable to extract data" when logged out — that is Instagram, not
  the app. The account option above is the fix, using your own session.
- **Pinterest image pins** are recognised and downloaded as images; the
  engine path is implemented and covered by unit tests, but the live
  sample pins checked during development all exposed video formats, so a
  purely image-only pin has not been verified live yet.
- **TikTok profile listing** can time out on slow or filtered networks.
- Subtitles come from the subtitle tracks the video itself carries; the
  app lists exactly those languages and no others.
- Speed through the tunnel is bounded by the WARP route; direct downloads
  are as fast as your connection and the source site allow.

## Build from source

Requirements: Node.js 20+ and npm, on Windows (the packaged app targets
Windows; the pure-logic unit tests run anywhere).

```bat
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube-downloader
build.bat
```

`build.bat` fetches the runtime binaries into `vendor\` (Aether, yt-dlp,
ffmpeg — see `scripts/fetch-binaries.js`), installs dependencies and builds
the installer into `dist_out\`. The steps individually:

```bat
npm install
npm run fetch:binaries
npm run dist
```

Run in development (uses the binaries in `vendor\`):

```powershell
$env:KAMANTUBE_DEV = "1"
npm start
```

Run the unit tests (Node's built-in test runner, no extra dependencies):

```bat
npm test
```

## Project layout

```text
main.js            Electron main process: window, IPC, blocklist enforcement
preload.js         context-isolated bridge (no Node access in the renderer)
src/providers.js   provider registry: URL detection, capabilities, blocklist
src/routing.js     SmartRoutingManager (facade over the tunnel manager)
src/tunnel.js      Aether orchestration: detection, protocols, health checks
src/yt.js          yt-dlp service: search, info, playlists, downloads
src/i18n.js        all UI strings for the 7 languages + RTL rules
src/state.js       persistent settings (JSON in the user data folder)
renderer/          the interface (11 sections, vanilla JS + CSS)
scripts/           binary fetching, release upload, CDP smoke/e2e checks
test/              unit tests (node:test)
vendor/            runtime binaries, fetched — not in git
```

## Privacy

KamanTube collects nothing and has no server of its own: no accounts, no
analytics, no telemetry. Your public IP is fetched only to show it to you
and to decide whether the tunnel is needed. Settings, queue and history
are stored locally in the app's data folder. Account access, when you
enable it, is read by yt-dlp directly from your browser or your cookies
file — see above.

## Credits and licenses

| Component | License | How it is used |
|---|---|---|
| [Aether](https://github.com/CluvexStudio/Aether) (CluvexStudio) | AGPL-3.0 | Tunnel core. Official binary, unmodified, run as an external process; KamanTube never links or modifies its code. |
| [PattN](https://github.com/patterniha/PattN) (patterniha) | GPL-3.0 | Architecture reference only: PattN — a fork of [v2rayN](https://github.com/2dust/v2rayN) — integrates the Aether core into a desktop client the same way. No PattN code is copied or bundled. |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense | Search, extraction and downloading. Bundled binary. |
| [FFmpeg](https://ffmpeg.org) (GyanD/codexffmpeg essentials build) | GPL | Merging streams, audio extraction, embedding subtitles/thumbnails. Bundled binary. |
| [Electron](https://www.electronjs.org/) / Chromium / Node.js | MIT / BSD-3-Clause | Application runtime. |

Full attributions and license texts: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and the rules
that keep feature claims honest, [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
for community standards, and [SECURITY.md](SECURITY.md) for reporting a
vulnerability.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Mohammad Hasan Kaman.
The MIT license covers KamanTube's own code only; bundled components remain
under their own licenses as listed above.
