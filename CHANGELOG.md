# Changelog

All notable changes to KamanTube are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [3.0.0] - 2026-11-06

A ground-up rewrite of the v2 line: from a YouTube downloader with a tunnel
to a universal media downloader with a provider architecture. The user
interface was designed and built from zero; the v2 tunnel and yt-dlp logic
that had been validated on real networks was kept and extended.

### Added

- **Universal Download Engine.** A shared provider registry
  (`src/providers.js`) with one contract for every platform — URL
  detection, capabilities, listing kind — covering YouTube, Pinterest,
  Instagram, TikTok and X, plus a generic fallback for any other site
  yt-dlp supports. Capabilities are only claimed where the underlying
  extractor really provides them (e.g. in-app search exists only for
  YouTube, because the other platforms offer no public search).
- **Playlists & Profiles page** for YouTube playlists and channels,
  Pinterest boards and profiles, and TikTok / Instagram / X profiles,
  with the detected listing kind shown before loading.
- **Pinterest image pins**: image-only pins are recognised and can be
  downloaded as images.
- **Explore section** on the Search page, routing to each platform's
  listing page and stating plainly why search is YouTube-only.
- **SmartRoutingManager** (`src/routing.js`): the v2 tunnel manager under
  its architectural name — IP/country detection, tunnel only for Iranian
  IPs in Auto mode, MASQUE over HTTP/2 first, automatic WARP identity,
  cached working recipe, background health checks and reconnects.
- **Per-site route fallback**: extraction tries the preferred route first
  and falls back to the other (YouTube needs the tunnel from Iran, TikTok
  geo-blocks the tunnel exit); a download that fails with a geo-block
  error is retried once on the direct route, and real yt-dlp error lines
  are surfaced instead of bare exit codes.
- **Account access** (Settings → Account): Off / browser session /
  cookies.txt file, all explicit opt-in. The app never asks for or stores
  a password; cookie values are never logged. Account use can be dropped
  per download, and login/bot-check failures produce a localised hint
  pointing at the setting.
- **Site blocking**: a built-in adult-site blocklist (20 domains,
  subdomains included) that ships ON, plus user-defined extra domains,
  enforced in the main process for info, playlist and download calls.
- **Seven languages**: Persian, English, German, Arabic, Spanish, Russian
  and Chinese — 210 keys each — switched live with no reload and no
  restart. Persian and Arabic are fully RTL; direction comes from the
  i18n module, and dynamic titles use `dir=auto` to stay readable in
  mixed-direction text.
- **Diagnostics page**: public IP, country, routing mode, active protocol,
  component versions and a live connection log.
- **Media Library page**: browse, open, reveal and delete downloaded
  files (deletion is restricted to the downloads folder).
- **Unit tests** (`test/`, Node's built-in runner): provider URL
  detection, blocklist matching, i18n key symmetry and placeholder
  parity across all seven languages, RTL set, and the yt-dlp info-shape
  mapping.
- Full documentation set: README rewrite, CONTRIBUTING,
  CODE_OF_CONDUCT, SECURITY, NOTICE.

### Changed

- **Interface rebuilt from zero** — 10 pages (Home, YouTube Search,
  New Download, Playlists & Profiles, Download Queue, Download History,
  Media Library, Settings, Diagnostics, About), a precision-tool design
  with one accent colour, skeleton loading states, and respect for
  `prefers-reduced-motion`. The light theme (warm paper) is designed
  independently of the dark theme (ink); System follows the OS.
- **Download queue**: pause/resume through yt-dlp partial files
  (`--continue`), configurable concurrency (1–5, default 2), an optional
  global speed limit (`--limit-rate`), duplicate prevention per link and
  quality, queue and history persisted across restarts, and targeted
  per-job UI updates (progress no longer rebuilds the list).
- **Subtitles and thumbnails** are per-download modes — embedded,
  separate file, or disabled — replacing the v2 checkboxes, with defaults
  in Settings.
- **Language switching no longer reloads the window** (v2 reloaded the
  whole UI); strings and layout direction update in place.
- Installer artifact name is stable: `KamanTube-Setup-<version>.exe`.
- Third-party notices corrected: the architecture reference is spelled
  **PattN** (an earlier draft of the notices misspelled it).

### Fixed

- Download progress math: downloaded bytes are now derived from the
  reported total size and percentage (previously the total was reported
  as the downloaded amount).
- Pinterest short links (`pin.it`) are detected as Pinterest. They
  previously fell through to the generic web provider, because the
  provider's host pattern shadowed its own host list.
- Video info results no longer throw when an extractor omits both the
  webpage and original URL; the requested URL is used as the fallback.

## [2.2.0] - 2026-10-31

- Tunnel protocol order fixed: MASQUE over HTTP/2 is always tried first.
- Auto-reconnect loop for a dropped tunnel.
- Full language reload on switch; redesigned light theme.
- Subtitle/thumbnail options restored in the download preview; playlist
  badges; route fallback for proxied requests.

## [2.1.0] - 2026-10-29

- Settings page and theme switcher.
- Embedded subtitles and thumbnails; tunnel watchdog; session proxy so
  thumbnails load through the tunnel; in-place queue updates; open-folder
  action; third-party license notices.
- Releases became installer-only.

## [2.0.0] - 2026-10-28

- First release of the Electron rewrite under the KamanTube name, with
  the automatic Aether tunnel. Supersedes the v1 "TubeX" PyQt app.

[3.0.0]: https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases/tag/v3.0.0
[2.2.0]: https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases/tag/v2.2.0
[2.1.0]: https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases/tag/v2.1.0
[2.0.0]: https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases/tag/v2.0.0
