# Contributing to KamanTube

Contributions are welcome: bug reports, fixes, translations and code.
This document covers setup and the few rules that keep the project
trustworthy.

## Ground rules

- **Never claim a capability the code does not have.** Every feature
  statement — in the UI, the README, or a pull request description —
  must be traceable to the extractors and code that actually run. If a
  platform limits something (for example, Instagram without a session),
  document the limit instead of working around the truth.
- **Verify against the source, not against other downloaders.** When in
  doubt about what yt-dlp can do with a platform, test the bundled
  yt-dlp directly.
- **No credentials, ever.** The app never asks for or stores passwords,
  and contributions must keep it that way. Account access stays opt-in
  (browser session or a user-supplied cookies.txt) and cookie values are
  never logged.
- **Bundled binaries stay unmodified.** Aether, yt-dlp and ffmpeg ship
  as the official release binaries, fetched by `scripts/fetch-binaries.js`.
  Do not commit binaries, and do not patch them.

## Development setup

Requirements: Node.js 20+, npm, Windows for the packaged build (unit
tests run on any platform).

```bat
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube-downloader
npm install
npm run fetch:binaries
```

Run the app against the fetched `vendor\` binaries:

```powershell
$env:KAMANTUBE_DEV = "1"
npm start
```

Build the installer:

```bat
npm run dist
```

Output lands in `dist_out\`. `vendor\`, `node_modules\` and `dist_out\`
are git-ignored; never commit them.

## Tests

```bat
npm test
```

Unit tests use Node's built-in test runner (`node:test`) — no extra
dependencies. They cover the pure logic that can run without Electron:
provider URL detection and the blocklist (`src/providers.js`), i18n key
symmetry and the RTL set (`src/i18n.js`), and the yt-dlp info-shape
mapping (`src/yt.js`). New pure logic should come with tests in `test/`.

There are also CDP-driven smoke and end-to-end scripts in `scripts/`
(`v3-smoke.js`, `v3-e2e.js`) that run against a live app instance on
Windows; they need a running app and network access, so they are not
part of `npm test`.

## Code layout

- `main.js` — Electron main process: window, IPC, blocklist enforcement.
  Anything security-relevant (blocking, file deletion, shell access) is
  enforced here, never only in the renderer.
- `preload.js` — the context-isolated bridge. The renderer has no Node
  access; expose new capabilities here explicitly, one handler at a time.
- `src/providers.js` — loaded by both the renderer (as a plain script)
  and the main process (`require`). Keep it dependency-free and UMD-style.
- `src/yt.js`, `src/tunnel.js`, `src/routing.js` — services. No Electron
  imports in these files; they must stay loadable from plain Node.
- `renderer/` — vanilla JS and CSS, no framework, no build step.

## Translations

All UI strings live in `src/i18n.js`. Adding or changing a string means
updating **all seven languages** (fa, en, de, ar, es, ru, zh) in the same
change — the unit tests fail on asymmetric key sets or mismatched
`{placeholder}` tokens. Persian is the default language; fa and ar are
RTL. If you cannot translate a string into every language, say so in the
pull request instead of shipping a partial dictionary.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `test:`, `build:`, `chore:` — one logical
  change per commit.
- Keep pull requests focused; describe what you verified and how
  (commands run, platforms tested).
- `npm test` must pass, and user-facing changes should update the
  relevant docs (README / CHANGELOG) in the same pull request.
- Development happens on feature branches. Releases are cut from `main`
  by the maintainer and are installer-only, with a SHA-256 checksum
  published next to the installer.

## Reporting bugs

Open an issue with: your Windows version, the KamanTube version
(Settings or Diagnostics shows it), the platform and link type involved,
what you expected, and what happened. The Diagnostics page (public IP,
routing mode, protocol, connection log) exists to make this easy —
include its output, but **remove anything you consider private first**
and never attach cookies files or WARP identity files.

For security issues, do not open a public issue — see
[SECURITY.md](SECURITY.md).
