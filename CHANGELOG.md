# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Placeholder screenshots (SVG format) for better visualization without actual screenshots.
- `CONTRIBUTING.md` guide for community engagement.

## [1.0.0] - 2026-07-03

### Added
- Initial release of YouTube Downloader Pro.
- **Modern Persian RTL Interface:** Fully localized UI with Tahoma font and Dark/Light themes.
- **Live Progress Tracking:** 3-stage progress bar (Fetching → Processing → Download) with speed, ETA, and size.
- **Browser Cookie Support:** Bypass "Sign in to confirm" restrictions using Chrome, Firefox, Edge, Opera, or Brave cookies.
- **Precise Quality Selection:** Choose from Video+Audio, Audio-only (MP3), Video-only, or all available formats.
- **Custom Save Path:** Option to select any folder for downloads.
- **Multi-threaded:** Non-blocking GUI for smooth performance.
- **Error Handling:** Comprehensive logging and user-friendly messages.
- **Zero Config Setup:** Simple `pip install -r requirements.txt` and run.

### Technical Details
- **Built with:** Python, CustomTkinter, yt-dlp, browser-cookie3
- **Platform:** Windows, macOS, Linux
- **License:** MIT