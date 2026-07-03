# 🎬 YouTube Downloader Pro - Advanced Video & Audio Downloader

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?logo=python&logoColor=white)](https://python.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/Mohammad-Hasan-Kaman/youtube-downloader?style=social)](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader)

> **Professional YouTube downloader with a modern Persian RTL interface, live progress tracking, browser cookie support, and precise quality selection.**  
> Built with ❤️ using **Python**, **CustomTkinter**, and **yt-dlp**.

---

## ✨ Features

| Feature | Description |
|:---|:---|
| 🎨 **Modern Persian UI** | Fully RTL interface,Tahoma font, Dark/Light themes |
| 📊 **3-Stage Progress** | Fetching → Processing → Download (with speed, time, size) |
| 🔐 **Browser Cookies** | Bypass "Sign in to confirm" restrictions (Chrome/Firefox/Edge/Opera/Brave) |
| 🎯 **Precise Quality** | Video+Audio, Audio-only (MP3), Video-only, All formats |
| 📁 **Custom Save Path** | Choose any folder for downloads |
| 🧵 **Multi-threaded** | Non-blocking GUI, smooth performance |
| 🛡 **Error Handling** | Comprehensive logging, user-friendly messages, auto-retry |
| 📦 **Zero Config** | Just `pip install -r requirements.txt` and run |

---

## 📸 Screenshots

> *Note: Screenshots will be added to `assets/` folder. Running the app once will help capture these.*

| Main Interface | Quality Selection | Download Progress |
|:---:|:---:|:---:|
| ![Main UI](assets/screenshot_main.png) | ![Quality](assets/screenshot_quality.png) | ![Progress](assets/screenshot_progress.png) |

*(Placeholders shown - replace with actual screenshots after first run)*

---

## 🚀 Installation & Setup

### Prerequisites
- **Python 3.10+** ([Download](https://python.org/downloads))
- **Git** (optional, for cloning)
- **FFmpeg** (required for video+audio merging)
  - **Windows:** `winget install Gyan.FFmpeg` or download from [ffmpeg.org](https://ffmpeg.org)
  - **Linux:** `sudo apt install ffmpeg` or `sudo dnf install ffmpeg`
  - **macOS:** `brew install ffmpeg`

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube-downloader

# 2. Create a virtual environment (recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the application
python youtube_downloader.py
```

### Build as Executable (Optional)
```bash
pip install pyinstaller
pyinstaller --onefile --windowed --icon=assets/icon.ico --add-data "assets;assets" youtube_downloader.py
# Output: dist/youtube_downloader.exe (Windows) or dist/youtube_downloader (Linux/macOS)
```

---

## 📖 How to Use

1. **Copy URL** — Copy YouTube link (watch, youtu.be, shorts, or playlist)
2. **Paste Link** — Click 📋 button or press Ctrl+V in the input field
3. **Fetch Info** — Click 🔍 "Get Video Info" button
4. **Choose Quality** — Select from the dropdown (Video+Audio, Audio-only, etc.)
5. **Set Path** — Choose download folder (default: `~/Downloads`)
6. **Start Download** — Click ⬇️ "Start Download"
7. **Monitor Progress** — Watch 3 progress bars, speed, ETA, and file size

### 🔐 Using Browser Cookies (for restricted videos)
- Check ✅ "Use Browser Cookies"
- Select your browser (Chrome is default)
- **Important:** Be logged into YouTube in that browser before running

---

## 🏗 Project Structure

```
youtube-downloader/
├── youtube_downloader.py    # Main application (GUI + Core Logic)
├── requirements.txt         # Python dependencies
├── .gitignore              # Git ignore rules
├── LICENSE                 # MIT License
├── README.md               # This file
└── assets/                 # Images, icons, screenshots
    ├── icon.ico            # App icon (optional)
    ├── screenshot_main.png
    ├── screenshot_quality.png
    └── screenshot_progress.png
```

---

## ⚙️ Advanced Configuration

### Environment Variables (Optional)
Create a `.env` file in the root:
```env
DEFAULT_DOWNLOAD_PATH=D:\Videos\YouTube
DEFAULT_BROWSER=chrome
DEFAULT_THEME=dark
```

### Customization
- **Theme:** Modify `youtube_downloader.py`:
  ```python
  ctk.set_appearance_mode("dark")  # Options: "light", "dark", "system"
  ctk.set_default_color_theme("blue")  # Options: "blue", "green", "dark-blue"
  ```

---

## 🐛 Troubleshooting

| Issue | Solution |
|:---|:---|
| `ffmpeg not found` | Install FFmpeg and add to PATH |
| `Sign in to confirm` | Enable browser cookies, disable VPN |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| Download stalls | Check internet, try lower quality |
| Error 403/429 | Refresh cookies, avoid VPN, wait a few minutes |
| Slow download | Check connection, try stable download speed |

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/awesome-feature`
3. Commit your changes: `git commit -m 'Add awesome feature'`
4. Push to the branch: `git push origin feature/awesome-feature`
5. Open a Pull Request

**Ideas for contribution:**
- Playlist & Channel download support
- Download queue manager
- Scheduled downloads
- Format converter
- Log file export

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 👨‍💻 About the Author

**Mohammad Hasan Kaman**  
- 🌐 **GitHub:** [@Mohammad-Hasan-Kaman](https://github.com/Mohammad-Hasan-Kaman)  
- 💼 **LinkedIn:** [Profile](https://linkedin.com/in/mohammad-hasan-kaman)  
- 📧 **Email:** [Your Email Here](mailto:your.email@example.com)  

I'm a 17-year-old Full-Stack Developer enthusiast passionate about Python, AI, and building practical tools. This project is part of my journey to become a professional developer.

---

## ⭐ Support the Project

If you find this tool useful, please **give it a star**! ⭐  
Your support motivates me to keep improving and adding new features.

[![Star History](https://api.star-history.com/svg?repos=Mohammad-Hasan-Kaman/youtube-downloader&type=Date)](https://star-history.com/#Mohammad-Hasan-Kaman/youtube-downloader&Date)

---

> **Disclaimer:** This tool is for personal and educational use only. Please respect YouTube's Terms of Service and content creators' copyright.