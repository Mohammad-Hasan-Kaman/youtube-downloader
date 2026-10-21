# 🎬 YouTube Downloader Pro

> An advanced YouTube downloader with a Persian-language interface, live progress tracking, and precise format selection.

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Mohammad-Hasan-Kaman/youtube-downloader?color=blue)](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases)

---

## 🚀 Purpose & Target Audience

This project is designed for **"easy access without technical knowledge"**:

| Audience | Usage Method |
|----------|--------------|
| **Casual Users** | Download and run the standalone `.exe` file (No Python or dependencies needed). |
| **Developers** | Clone the source code to study, modify, or extend the functionality. |

> **Platform:** Windows. The app calls `ctypes.windll` to enable per-monitor DPI awareness, so it does not run on Linux or macOS.

---

## ✨ Key Features

- 🎨 **Persian-language UI with dark mode:** Every label, message and progress stage is in Persian, with Dark Mode enabled by default.
- 📊 **Three live progress bars:**
  1.  **Metadata fetch** — an animated indicator that fills while YouTube is queried and the format list is extracted.
  2.  **Download** — real-time percentage, speed, ETA and transferred/total size.
  3.  **Overall** — a single bar that tracks the whole operation, with a text stage and a colour that changes with the percentage.
- 🎯 **Precise Quality & Format Selection:**
  - **Video + audio:** 1080p, 720p, 480p, etc. — the last 12 muxed formats, sorted by height.
  - **Audio only:** the last 4 audio-only streams, sorted by bitrate, each shown with its native container, bitrate and size.
  - Every option shows the real container, resolution, frame rate and file size that YouTube reports.
- 🔐 **Browser Cookie Support:** Bypass IP restrictions or reach age/region-restricted videos by extracting cookies from Chrome, Firefox, Edge, Opera or Brave automatically.
- 📁 **Custom Save Path:** Choose any destination folder for your downloads.
- 🧵 **Multi-threaded:** Smooth performance with non-blocking UI.
- 🛡 **Advanced Error Handling:** Clear, user-friendly error messages.

---

## 📥 Installation & Usage

### 1. For Casual Users (No Python Required)
1.  Go to the [Releases](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases) page.
2.  Download the latest version (`YouTube-Downloader-Pro.exe`).
3.  Run the executable.
4.  Paste the link and start downloading!

### 2. For Developers (Source Code)
```bash
# Clone the repository
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube_downloader

# Install dependencies (Python 3.10+ required)
pip install -r requirements.txt

# Run the application
python youtube_downloader.py
```

---

## 🛠 Tech Stack

| Technology | Role |
|------------|------|
| **Python 3.10+** | Core programming language |
| **CustomTkinter** | Dark-mode desktop GUI (Windows) |
| **yt-dlp** | Powerful download engine & metadata extractor |
| **browser-cookie3** | Secure extraction of browser cookies |

---

## 📸 Screenshots

*Visual representation of the application interface.*

<div align="center">

| Home Screen | Quality Selection | Progress Tracking |
|:---:|:---:|:---:|
| <img src="assets/screenshot_main.svg" width="300" alt="Home Screen"/> | <img src="assets/screenshot_quality.svg" width="300" alt="Quality Selection"/> | <img src="assets/screenshot_progress.svg" width="300" alt="Download Progress"/> |

</div>

---

## 📝 How to Use

1.  **Paste Link:** Enter the YouTube URL in the input field.
2.  **Fetch Info:** Click the **"Get Info"** button to retrieve available formats.
3.  **Select Format:**
    - **Video + audio:** choose one of the muxed formats (`.mp4` or `.webm`).
    - **Audio only:** choose one of the audio-only streams (`.m4a`, `.webm` or `.opus`).
4.  **Download:** Click the **"Download"** button to start.
5.  **Monitor:** Watch the 3-stage progress bar and real-time speed.

---

## 📂 Project Structure

```
youtube_downloader/
├── assets/                  # Assets and screenshots
│   ├── screenshot_main.svg
│   ├── screenshot_quality.svg
│   └── screenshot_progress.svg
├── CHANGELOG.md             # Version history
├── CONTRIBUTING.md          # Contribution guidelines
├── LICENSE                  # MIT License
├── README.md                # Documentation
├── requirements.txt         # Python dependencies
├── youtube_downloader.py    # Main application
└── take_screenshot.py       # Screenshot generator
```

---

## 🤝 Contributing

Found a bug or have a suggestion? Please open an [Issue](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/issues).
Contributions are welcome! Please follow the guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## ⭐ Support

If you find this tool useful, please give it a **star**! ⭐  
Your support motivates further development.

[![Stars](https://img.shields.io/github/stars/Mohammad-Hasan-Kaman/youtube-downloader?style=for-the-badge&logo=github&color=blue)](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/stargazers)

---
*Maintained by Mohammad Hasan Kaman | Last updated: October 2026*

> **Disclaimer:** This tool is for personal and educational use only. Please respect YouTube's Terms of Service and content creators' copyright.
