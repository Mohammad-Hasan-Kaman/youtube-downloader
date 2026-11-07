# Changelog

All notable changes to KamanTube are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [3.1.0] - 2026-11-07

A revision driven by the first hands-on test of 3.0.0 by the owner: two
download-path bugs, a faster preview, and a set of interface changes he
asked for by name.

### Fixed

- **Queued downloads that never started.** Jobs restored from the saved
  queue at launch were never pumped, so they sat in the queue forever;
  restored 'queued' jobs now start at boot. Downloads also no longer lock
  onto the renderer's stale route snapshot: the main process decides the
  route at spawn time and waits for the tunnel to settle first. The stall
  watchdog measures real download progress instead of yt-dlp's retry
  chatter (which used to reset it forever), downloads carry bounded
  network retries, and a failed spawn now reports an error instead of
  leaking its queue slot silently.
- **Slow previews.** The preview flow paid up to two full extractions in
  series (plus a second route's timeout) before showing anything. It now
  asks the endpoint that matches the URL shape first, extraction calls
  fail fast on dead routes (`--socket-timeout` / bounded retries), info
  results are cached for five minutes with in-flight de-duplication, and
  a missing `await` in the tunnel's free-port probe (which made every
  attempt reuse the same port) is fixed.

### Added

- **Detail page for search results.** Clicking a result opens that
  content's own page — preview, qualities and download — instead of the
  card carrying inline Download / Quality buttons.
- **Platforms page and a section per platform.** Every platform now has
  its own space: its link box, capability chips and shortcuts (search
  for YouTube, listings for the others).
- **Supported Sites directory.** Every site the bundled yt-dlp can
  download from — over 1,700 — listed and searchable, read live from
  `yt-dlp --list-extractors`.
- **New app icon**: an amber play/download mark on charcoal.

### Changed

- **Adult-site filtering is built in and always on.** The Settings →
  Safety section is gone; the built-in list grew from 20 to 100+
  domains and can no longer be switched off or edited in the app.
- **The "best quality" option names its resolution** (e.g. "Best quality
  (1080p)"), taken from the formats the site actually offers.
- **Responsive layout and a topbar/settings redesign**: the topbar wraps
  instead of squeezing (64 px, roomier network chip and switchers),
  settings cards get pill titles that no longer render half-clipped and
  a two-column grid, the sidebar collapses to an icon rail under
  1020 px, and the window can shrink to 860 px.
- Persian wording: "تصویر پیش‌نمایش" (preview image) replaces the
  "بندانگشتی" calque for thumbnails.

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
- **Automatic captions**: auto-generated caption languages are listed
  in the download preview next to the manual subtitle tracks, labelled
  as automatic, and are fetched with yt-dlp's `--write-auto-subs`. A
  language that has a real manual track keeps using it.
- **Queue priority**: pending downloads can be raised or lowered with
  the arrow buttons on their queue row. When a slot frees, the
  highest-priority job starts next (insertion order breaks ties);
  priority is saved with the queue and survives a restart. With no
  reordering, the queue behaves exactly as the previous FIFO.
- **Unit tests** (`test/`, Node's built-in runner): provider URL
  detection, blocklist matching, i18n key symmetry and placeholder
  parity across all seven languages, RTL set, the yt-dlp info-shape
  mapping, subtitle argument construction (manual vs auto-generated
  captions), and queue priority selection.
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
