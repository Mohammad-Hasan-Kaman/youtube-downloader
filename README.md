# 🎬 YouTube Downloader Pro

> یک دانلودر پیشرفته یوتیوب با رابط کاربری مدرن فارسی (RTL)، پشتیبانی از نوار پیشرفت زنده و انتخاب دقیق کیفیت و فرمت.

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?logo=python&logoColor=white)](https://python.org)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Mohammad-Hasan-Kaman/youtube-downloader?color=blue)](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases)

---

## 🚀 هدف و مخاطبان

این پروژه با رویکرد **"دسترسی آسان بدون نیاز به دانش فنی"** طراحی شده است:

| مخاطب | روش استفاده |
|-------|--------------|
| **کاربران عادی** | دانلود و اجرای مستقیم فایل `.exe` (بدون نیاز به نصب پایتون یا کتابخانه‌ها). |
| **توسعه‌دهندگان** | کپی کردن سورس کد و اجرای مستقیم با `python` برای مطالعه یا توسعه بیشتر. |

---

## ✨ ویژگی‌های کلیدی

- 🎨 **رابط کاربری مدرن فارسی (RTL):** طراحی تمیز، حالت تاریک (Dark Mode) به صورت پیش‌فرض.
- 📊 **نمایش زنده پیشرفت (3 مرحله):**
  1.  **FETCHING:** دریافت اطلاعات ویدیو.
  2.  **PROCESSING:** انتخاب کیفیت و آماده‌سازی.
  3.  **DOWNLOADING:** دانلود با نمایش سرعت و زمان باقی‌مانده (ETA).
- 🎯 **انتخاب دقیق کیفیت و فرمت:**
  - **ویدیو + صدا:** نسخه‌های 1080p, 720p, 480p و...
  - **فقط صدا:** تبدیل به MP3/MP4 با نرخ نمونه‌برداری مشخص (128kbps, 192kbps, 256kbps).
  - **فقط ویدیو:** دانلود بدون صدا.
- 🔐 **پشتیبانی از کوکی مرورگر:** دور زدن محدودیت‌های IP یا دانلود ویدیوهای Private با استخراج خودکار کوکی‌های کروم/فایرفاکس.
- 📁 **مسیر دلخواه:** انتخاب پوشه مقصد برای ذخیره دانلودها.
- 🧵 **چند رشته‌ای (Multi-threaded):** مدیریت همزمان دانلودها بدون قفل شدن رابط کاربری.
- 🛡 **مدیریت خطاهای پیشرفته:** نمایش پیام‌های خطای واضح و قابل فهم.

---

## 📥 نصب و اجرا

### ۱. برای کاربران عادی (بدون نیاز به پایتون)
1.  به بخش [Releases](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/releases) بروید.
2.  آخرین نسخه (`v1.0.0` یا بالاتر) را دانلود کنید.
3.  فایل `YouTube-Downloader-Pro.exe` را اجرا کنید.
4.  لینک را وارد کنید و دانلود را شروع کنید!

### ۲. برای توسعه‌دهندگان (از سورس کد)
```bash
# کلون کردن مخزن
git clone https://github.com/Mohammad-Hasan-Kaman/youtube-downloader.git
cd youtube_downloader

# نصب وابستگی‌ها (فقط در صورتی که پایتون دارید)
pip install -r requirements.txt

# اجرای برنامه
python youtube_downloader.py
```

---

## 🛠 تکنولوژی‌های استفاده شده

| تکنولوژی | نقش |
|-----------|-----|
| **Python 3.10+** | زبان برنامه‌نویسی اصلی |
| **CustomTkinter** | رابط کاربری مدرن و زیبا |
| **yt-dlp** | هسته دانلود و استخراج اطلاعات |
| **browser-cookie3** | استخراج کوکی‌های مرورگر |

---

## 📸 تصاویری از برنامه

*(تصاویر SVG با کیفیت بالا که چیدمان و ویژگی‌های برنامه را نشان می‌دهند)*

<div align="center">

| صفحه اصلی (Home) | انتخاب کیفیت (Quality) | پیشرفت دانلود (Progress) |
|:---:|:---:|:---:|
| <img src="assets/screenshot_home.svg" width="300" alt="Home Screen"/> | <img src="assets/screenshot_quality.svg" width="300" alt="Quality Selection"/> | <img src="assets/screenshot_progress.svg" width="300" alt="Download Progress"/> |

*افزایش کیفیت تصاویر با کلیک روی آن‌ها*

</div>

---

## 📝 راهنمای استفاده

1.  **وارد کردن لینک:** لینک ویدیو را در کادر متنی وارد کنید.
2.  **دریافت اطلاعات:** روی دکمه **"دریافت اطلاعات"** کلیک کنید.
3.  **انتخاب فرمت:**
    - برای **دانلود ویدیو + صدا:** یک فرمت با پسوند `mp4` یا `webm` انتخاب کنید.
    - برای **فقط صدا:** فرمت‌های `m4a` یا `mp3` را انتخاب کنید.
    - برای **فقط ویدیو:** فرمت‌های بدون صدا (مثل `mp4` با گزینه "Best video only") را انتخاب کنید.
4.  **شروع دانلود:** روی دکمه **"دانلود"** کلیک کنید.
5.  **نظارت بر پیشرفت:** نوارهای پیشرفت ۳ مرحله‌ای به شما نشان می‌دهند که برنامه در کدام مرحله است.

---

## 📂 ساختار پروژه

```
youtube_downloader/
├── assets/                  # فایل‌های گرافیکی و اسکرین‌شات‌ها
│   ├── screenshot_home.svg
│   ├── screenshot_quality.svg
│   └── screenshot_progress.svg
├── CHANGELOG.md             # تاریخچه تغییرات
├── CONTRIBUTING.md          # راهنمای مشارکت
├── LICENSE                  # مجوز MIT
├── README.md                # این فایل
├── requirements.txt         # وابستگی‌های پایتون
├── youtube_downloader.py    # کد اصلی برنامه
└── take_screenshot.py       # اسکریپت تولید اسکرین‌شات
```

---

## 🤝 مشارکت

اگر باگ یا پیشنهادی دارید، لطفاً یک [Issue](https://github.com/Mohammad-Hasan-Kaman/youtube-downloader/issues) باز کنید.
ورود به پروژه و توسعه آن برای توسعه‌دهندگان خوش‌آمد است. لطفاً از [CONTRIBUTING.md](CONTRIBUTING.md) پیروی کنید.

---

## ⭐ حمایت

اگر از این ابزار استفاده می‌کنید، لطفاً یک **⭐ ستاره** به آن بدهید!
از حمایت شما متشکرم.

[![Star History](https://api.star-history.com/svg?repos=Mohammad-Hasan-Kaman/youtube-downloader&type=Date)](https://star-history.com/#Mohammad-Hasان-Kaman/youtube-downloader&Date)

---
*Maintained by Mohammad Hasan Kaman | Last updated: July 2026*

> **سلب مسئولیت:** این ابزار صرفاً برای اهداف آموزشی و شخصی است. لطفاً قوانین خدمات YouTube و حقوق کپی رایت سازندگان را رع کنید.