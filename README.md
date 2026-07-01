# 🎬 YouTube Downloader Pro — دانلودر پیشرفته یوتیوب

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://python.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)]()
[![Stars](https://img.shields.io/github/stars/USERNAME/youtube-downloader?style=social)](https://github.com/USERNAME/youtube-downloader/stargazers)

> **دانلودر حرفه‌ای یوتیوب با رابط کاربری مدرن فارسی، نوار پیشرفت زنده، پشتیبانی از کوکی مرورگر و انتخاب کیفیت دقیق**  
> ساخته شده با ❤️ با **Python**، **CustomTkinter** و **yt-dlp**

---

## ✨ ویژگی‌ها

| ویژگی | توضیح |
|-----------|---------|
| 🎨 **رابط فارسی RTL** | کاملاً راست‌چین، فونت تاهما، تم تاریک/روشن |
| 📊 **نوار پیشرفت سه‌مرحله** | دریافت اطلاعات → پردازش → دانلود (با سرعت، زمان باقی‌مانده، حجم) |
| 🔐 **کوکی مرورگر** | عبور از محدودیت یوتیوب (Sign in to confirm) با Chrome/Firefox/Edge/Opera/Brave |
| 🎯 **انتخاب کیفیت دقیق** | ویدیو + صدا جداگانه، فقط صدا (MP3)، فقط ویدیو، همه فرمت‌ها |
| 📁 **مسیر ذخیره سفارشی** | انتخاب پوشه مقصد با مرورگر فایل |
| 🧵 **تعدد نخ (Threading)** | رابط کاربری همیشه پاسخگو، دانلود در پس‌زمینه |
| 🛡 **مدیریت خطا** | لاگ کامل، پیام‌های دوستانه، تلاش مجدد خودکار |
| 📦 **بدون نصب اضافه** | فقط Python + pip install -r requirements.txt |

---

## 📸 اسکرین‌شات‌ها

| رابط اصلی | انتخاب کیفیت | پیشرفت دانلود |
|:---:|:---:|:---:|
| ![Main UI](assets/screenshot_main.png) | ![Quality](assets/screenshot_quality.png) | ![Progress](assets/screenshot_progress.png) |

> **نکته:** پوشه `assets/` و عکس‌ها را بعد از اولین اجرا بسازید و اسکرین‌شات بگیرید.

---

## 🚀 نصب و اجرا

### پیش‌نیازها
- **Python 3.10+** ([دانلود](https://python.org/downloads))
- **Git**ffmpeg** در PATH سیستم (برای ادغام ویدیو+صدا)  
  - Windows: `winget install Gyan.FFmpeg` یا از [ffmpeg.org](https://ffmpeg.org/download.html)  
  - Linux: `sudo apt install ffmpeg`  
  - macOS: `brew install ffmpeg`

### مراحل نصب
```bash
# ۱. کلون مخزن
git clone https://github.com/USERNAME/youtube-downloader.git
cd youtube-downloader

# ۲. محیط مجازی (توصیه شده)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# ۳. نصب وابستگی‌ها
pip install -r requirements.txt

# ۴. اجرا
python youtube_downloader.py
```

### اجرا به صورت فایل اجرایی (اختیاری)
```bash
pip install pyinstaller
pyinstaller --onefile --windowed --icon=assets/icon.ico --add-data "assets;assets" youtube_downloader.py
# فایل در dist/youtube_downloader.exe ساخته می‌شود
```

---

## 📖 راهنمای استفاده

1. **لینک را کپی کنید** — از یوتیوب (watch, youtu.be, shorts, playlist)
2. **در برنامه Paste کنید** — دکمه 📋 یا Ctrl+V
3. **دریافت اطلاعات** — کلیک روی 🔍 «دریافت اطلاعات ویدیو»
4. **کیفیت را انتخاب کنید** — از لیست فرمت‌ها (ویدیو+صدا، فقط صدا، فقط ویدیو)
5. **پوشه مقصد را تنظیم کنید** — پیش‌فرض: `~/Downloads`
6. **شروع دانلود** — دکمه ⬇️ «شروع دانلود»
7. **پیشرفت را تماشا کنید** — نوارهای سه‌گانه، سرعت، زمان باقی‌مانده

### 🔐 کوکی مرورگر (برای ویدیوهای محدودیت‌دار)
- تیک ✅ «استفاده از کوکی مرورگر» را بزنید
- مرورگر مورد نظر را انتخاب کنید (Chrome پیش‌فرض)
- **مهم:** در آن مرورگر باید **به یوتیوب لاگین کرده باشید**

---

## 🛠 ساختار پروژه

```
youtube-downloader/
├── youtube_downloader.py    # کد اصلی برنامه (GUI + Logic)
├── requirements.txt         # وابستگی‌های پایتون
├── .gitignore              # فایل‌های نادیده‌گرفته‌شده
├── LICENSE                 # مجوز MIT
├── README.md               # همین فایل
└── assets/                 # آیکون، اسکرین‌شات‌ها (اختیاری)
    ├── icon.ico
    ├── screenshot_main.png
    ├── screenshot_quality.png
    └── screenshot_progress.png
```

---

## ⚙️ تنظیمات پیشرفته

### متغیرهای محیطی (اختیاری)
فایل `.env` بسازید:
```env
# مسیر پیش‌فرض دانلود
DEFAULT_DOWNLOAD_PATH=D:\Videos\YouTube

# مرورگر پیش‌فرض برای کوکی
DEFAULT_BROWSER=chrome

# تم پیش‌فرض (dark/light)
DEFAULT_THEME=dark
```

### سفارشی‌سازی تم
در کد (`youtube_downloader.py`):
```python
ctk.set_appearance_mode("dark")  # "light" یا "system"
ctk.set_default_color_theme("blue")  # "green", "dark-blue", ...
```

---

## 🐛 عیب‌یابی رایج

| خطا | راه‌حل |
|------|--------|
| `ffmpeg not found` | ffmpeg را نصب و به PATH اضافه کنید |
| `Sign in to confirm you're not a bot` | کوکی مرورگر را فعال کنید، VPN خاموش کنید |
| `ModuleNotFoundError: customtkinter` | `pip install -r requirements.txt` را اجرا کنید |
| دانلود متوقف می‌شود | اینترنت چک کنید، فرمت پایین‌تر انتخاب کنید |
| ارور 403/429 | کوکی معتبر، عدم استفاده از VPN، صبر چند دقیقه |

---

## 🤝 مشارکت (Contributing)

1. Fork کنید
2. شاخه بسازید: `git checkout -b feature/amazing-feature`
3. کامیت کنید: `git commit -m 'Add amazing feature'`
4. Push کنید: `git push origin feature/amazing-feature`
5. **Pull Request** باز کنید

ایده‌ها:
- پشتیبانی از پلی‌لیست و کانال
- صف دانلود (Queue)
- زمان‌بندی دانلود
- تبدیل خودکار به فرمت‌های دیگر
- لاگینگ به فایل

---

## 📄 مجوز (License)

این پروژه تحت مجوز **MIT License** منتشر شده است.  
فایل [LICENSE](LICENSE) را ببینید.

---

## 👨‍💻 نویسنده

**Mohammad Hasan**  
- GitHub: [@USERNAME](https://github.com/USERNAME)  
- LinkedIn: [Your Profile](https://linkedin.com/in/yourprofile)  
- Email: your.email@example.com

---

## ⭐ حمایت کنید

اگر این پروژه برایتان مفید بود، **ستاره دهید** و به دیگران معرفی کنید!  
این انگیزه من برای ادامه توسعه است.

[![Star History Chart](https://api.star-history.com/svg?repos=USERNAME/youtube-downloader&type=Date)](https://star-history.com/#USERNAME/youtube-downloader&Date)

---

> **نکته:** این ابزار تنها برای استفاده شخصی و آموزشی است. کپی‌رایت محتوای یوتیوب را محترم بمانید.