### 🌐 Telegram: [@mohaka_programmer](https://t.me/mohaka_programmer)

[![Telegram](https://img.shields.io/badge/Telegram-%40mohaka__programmer-2CA5E0?logo=telegram&logoColor=white)](https://t.me/mohaka_programmer)

---

# 🚀 TubeX — YouTube Downloader Pro

A modern, feature-rich YouTube downloader built with **PySide6** and **yt-dlp**, designed for users in restricted networks (Iran, etc.). Automatically tunnels traffic through **Aether** when YouTube is blocked — no manual configuration needed.

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Qt](https://img.shields.io/badge/Qt-6-PySide6-purple.svg)](https://pyside.org)

---

## ✨ Features

| Feature | Description |
|---|---|
| **🌐 Smart Tunnel** | Auto-detects if YouTube is blocked and launches Aether MASQUE tunnel in background |
| **🎬 Video Download** | Select quality (480p / 720p / 1080p / ...), container (.mp4 / .webm) |
| **🎵 Audio Download** | Extract audio as MP3 / M4A / OGG with bitrate selection |
| **📥 Subtitles** | Download subtitles in any supported language (Persian, English, Arabic…) |
| **🖼️ Thumbnails** | Optional: download video thumbnail along with the media |
| **📂 Playlist Support** | Paste a playlist URL and download all videos at once |
| **📜 Download History** | Persistent history with one-click re-download |
| **🌑 Dark Mode UI** | Modern, clean Persian RTL interface |
| **⌨️ Keyboard Shortcuts** | Enter to fetch/download, Esc to cancel |

---

## 🛠 Tech Stack

| Component | Technology |
|---|---|
| **GUI** | PySide6 (Qt 6) + custom QSS stylesheet |
| **Download Engine** | yt-dlp (Python binding) |
| **Tunnel / Proxy** | [Aether](https://github.com/CluvexStudio/Aether) — MASQUE over HTTP/3, SOCKS5 proxy |
| **Transcoding** | FFmpeg (auto-downloaded on first run) |
| **Packaging** | PyInstaller → standalone `.exe` |

---

## 📥 Installation

### Quick start (source)

```bash
# Clone the repository
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube-downloader

# Install dependencies
python -m pip install -r requirements.txt

# Run
python main.py
```

### Build standalone `.exe`

```bash
# Using PowerShell (recommended on Windows)
.\build.ps1

# Or use the batch script
build.bat
```

The executable will be placed in `dist/TubeX.exe`.

---

## 🧭 How It Works

1. **Launch** the app — it auto-checks your internet connection.
2. If YouTube is **accessible directly** — downloads happen without a tunnel.
3. If YouTube is **blocked** — Aether is silently launched in the background, establishes a MASQUE tunnel, and yt-dlp routes all traffic through the local SOCKS5 proxy (`127.0.0.1:1819`).
4. Paste a URL, pick your format, and hit download.

---

## 📂 Project Structure

```
youtube-downloader/
├── main.py            # Application entry point + MainWindow
├── tunnel.py          # Aether tunnel manager (auto-download + lifecycle)
├── worker.py          # yt-dlp download worker (threaded)
├── style.qss          # Dark modern stylesheet (QSS)
├── requirements.txt   # Python dependencies
├── build.bat          # PyInstaller build script (cmd)
├── build.ps1          # PyInstaller build script (PowerShell)
├── LICENSE            # MIT License
└── README.md          # This file
```

---

## 🔄 Credits

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — download engine
- **[Aether](https://github.com/CluvexStudio/Aether)** — MASQUE tunnel for censored networks
- **[FFmpeg](https://ffmpeg.org)** — video/audio transcoding
- **[Vazirmatn](https://github.com/rastikerdar/vazirmatn)** — Persian font (bundled if needed)

---

## ⚠️ Disclaimer

This tool is for personal and educational use only. Please respect YouTube's Terms of Service and content creators' copyright.

---

*Maintained by Mohammad-Hasan Kaman | Created 2026*
