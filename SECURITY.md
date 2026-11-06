# Security Policy

## Supported versions

Only the latest release of KamanTube receives security fixes. If you are
running an older version, update first — installers are published on the
[Releases](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases)
page with a SHA-256 checksum for verification.

## Reporting a vulnerability

Report security issues privately by email to
**mohammadhasankaman@gmail.com**. Do not open a public issue for a
vulnerability, and do not include exploit details in public discussions.

Please include:

- the KamanTube version and Windows version,
- a description of the issue and its impact,
- steps to reproduce, if you have them.

KamanTube is maintained by one person; reports are read and answered on
a best-effort basis. Coordinated disclosure is appreciated: please give
the maintainer a reasonable chance to ship a fix before publishing
details.

## Security model — what to know

KamanTube is a local desktop app. It runs no server, has no user
accounts, and collects no telemetry. Points that matter for a security
review:

- **Renderer isolation.** The interface runs with context isolation and
  no Node integration; all privileged operations go through the explicit
  preload bridge, and security-relevant checks (site blocking, library
  deletion) are enforced again in the main process.
- **Account access is opt-in and narrow.** With account access off (the
  default), no session data is read at all. In browser mode, yt-dlp
  reads your own browser's session at runtime; in cookies.txt mode, the
  app stores only the path of the file you chose. The app never asks
  for, stores, or logs passwords or cookie values. A cookies file is a
  credential — treat it like one and never share it.
- **Tunnel credentials.** The WARP identity that Aether creates lives in
  the app's data folder and is never logged or transmitted anywhere
  except to Cloudflare's registration endpoints by the Aether core
  itself. The Aether binary ships unmodified (AGPL-3.0; see
  THIRD_PARTY_NOTICES.md).
- **Unsigned builds.** Release installers are not code-signed yet, so
  Windows SmartScreen warns about an unknown publisher. Verify the
  SHA-256 checksum published with each release, and only download
  KamanTube from this repository's Releases page.
- **Site blocking is a user feature, not a security boundary.** The
  built-in blocklist ships on by default and is enforced in the main
  process, but the user who owns the app can switch it off.

## Out of scope

- Vulnerabilities in upstream components (Aether, yt-dlp, ffmpeg,
  Electron/Chromium) belong to those projects; report them upstream.
  If KamanTube's *packaging or use* of a component creates the issue,
  that is in scope here.
- Issues that require an attacker to already control the user's machine
  or the user's own cookies file.
- Platform restrictions themselves (for example a site refusing
  anonymous extraction) are limitations, not vulnerabilities.
