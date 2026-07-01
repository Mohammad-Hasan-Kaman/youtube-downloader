import customtkinter as ctk
import threading
import os
from tkinter import filedialog, messagebox
import re
import json
import time
from datetime import datetime, timedelta
import yt_dlp as youtube_dlp
import browser_cookie3
import traceback
import sys
import tempfile

# ============================================
# تنظیمات اولیه برای حل مشکل DPI
# ============================================
if sys.platform == "win32":
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(0)
    except:
        pass

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class YouTubeDownloaderApp:
    def __init__(self):
        try:
            self.window = ctk.CTk()
            self.window.title("دانلودر پیشرفته یوتیوب با نوار پیشرفت")
            self.window.geometry("1100x700")  # ارتفاع کمتر شده
            self.window.minsize(1000, 600)     # حداقل ارتفاع کمتر
            
            # متغیرهای برنامه
            self.downloading = False
            self.fetching = False
            self.selected_format = None
            self.video_info = None
            self.formats = []
            self.cookie_file = None
            
            # متغیرهای رابط کاربری
            self.url_var = ctk.StringVar()
            self.download_path = ctk.StringVar(value=os.path.expanduser("~/Downloads"))
            self.status_var = ctk.StringVar(value="آماده")
            
            # متغیرهای نوار پیشرفت
            self.fetch_progress_var = ctk.DoubleVar(value=0)
            self.download_progress_var = ctk.DoubleVar(value=0)
            self.total_progress_var = ctk.DoubleVar(value=0)
            
            # متغیرهای اطلاعات پیشرفت
            self.fetch_status_var = ctk.StringVar(value="آماده برای دریافت اطلاعات")
            self.download_status_var = ctk.StringVar(value="آماده برای دانلود")
            self.download_speed_var = ctk.StringVar(value="--")
            self.time_remaining_var = ctk.StringVar(value="--:--")
            self.file_size_var = ctk.StringVar(value="-- / --")
            self.current_stage_var = ctk.StringVar(value="مرحله: آماده")
            
            self.use_cookies = ctk.BooleanVar(value=True)
            self.browser_choice = ctk.StringVar(value="chrome")
            
            # فونت‌ها
            self.font_normal = ("Tahoma", 11)  # کوچکتر شده
            self.font_bold = ("Tahoma", 11, "bold")
            self.font_title = ("Tahoma", 16, "bold")  # کوچکتر شده
            self.font_small = ("Tahoma", 10)
            
            # زمان‌های شروع
            self.download_start_time = None
            self.fetch_start_time = None
            
            self.setup_ui()
            
        except Exception as e:
            print(f"خطا در راه‌اندازی: {e}")
            traceback.print_exc()
            raise
    
    def setup_ui(self):
        """ایجاد رابط کاربری با قابلیت اسکرول"""
        # فریم اصلی با اسکرول
        self.main_scrollable_frame = ctk.CTkScrollableFrame(
            self.window,
            label_text="دانلودر یوتیوب",
            scrollbar_button_color="#4CC9F0",
            scrollbar_button_hover_color="#3AA0C7",
            border_width=2,
            border_color="#2B2B2B"
        )
        self.main_scrollable_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        # تنظیم حداقل ارتفاع برای فریم اسکرول
        self.main_scrollable_frame._scrollbar.configure(height=300)
        
        # فریم داخلی برای سازماندهی بهتر
        main_content_frame = ctk.CTkFrame(self.main_scrollable_frame, fg_color="transparent")
        main_content_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # ============ هدر ============
        header_frame = ctk.CTkFrame(main_content_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 15))
        
        ctk.CTkLabel(
            header_frame,
            text="🎬 دانلودر پیشرفته یوتیوب",
            font=("Tahoma", 22, "bold"),  # کوچکتر شده
            text_color="#4CC9F0"
        ).pack()
        
        ctk.CTkLabel(
            header_frame,
            text="دانلود ویدیو و موزیک از یوتیوب با کیفیت دلخواه",
            font=self.font_normal,
            text_color="#888888"
        ).pack(pady=(5, 0))
        
        # ============ بخش ورودی ============
        input_frame = ctk.CTkFrame(main_content_frame)
        input_frame.pack(fill="x", pady=(0, 15))
        
        # عنوان بخش
        ctk.CTkLabel(
            input_frame,
            text="لینک ویدیو یوتیوب",
            font=self.font_bold
        ).pack(anchor="w", padx=15, pady=(12, 5))  # padding کمتر
        
        # کادر ورودی URL
        url_container = ctk.CTkFrame(input_frame, fg_color="transparent")
        url_container.pack(fill="x", padx=15, pady=5)
        
        self.url_entry = ctk.CTkEntry(
            url_container,
            textvariable=self.url_var,
            placeholder_text="https://www.youtube.com/watch?v=... یا https://youtu.be/...",
            font=self.font_normal,
            height=40  # ارتفاع کمتر
        )
        self.url_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        
        ctk.CTkButton(
            url_container,
            text="📋",
            command=self.paste_from_clipboard,
            width=45,  # عرض کمتر
            height=40,
            fg_color="#7209B7",
            hover_color="#5A189A"
        ).pack(side="right")
        
        # ============ تنظیمات کوکی ============
        cookie_frame = ctk.CTkFrame(input_frame, fg_color="transparent")
        cookie_frame.pack(fill="x", padx=15, pady=8)
        
        # چک‌باکس کوکی
        cookie_cb = ctk.CTkCheckBox(
            cookie_frame,
            text="🔐 استفاده از کوکی مرورگر",
            variable=self.use_cookies,
            font=self.font_bold,
            command=self.toggle_browser_selection,
            text_color="#FFB347"
        )
        cookie_cb.pack(side="left", padx=(0, 10))
        
        # راهنمای کوکی
        ctk.CTkButton(
            cookie_frame,
            text="❓",
            command=self.show_cookie_help,
            width=35,  # عرض کمتر
            height=30,
            fg_color="#6C757D",
            hover_color="#5A6268"
        ).pack(side="left", padx=(0, 15))
        
        # انتخاب مرورگر
        browser_label = ctk.CTkLabel(
            cookie_frame,
            text="مرورگر:",
            font=self.font_normal
        )
        browser_label.pack(side="left", padx=(0, 5))
        
        self.browser_menu = ctk.CTkOptionMenu(
            cookie_frame,
            values=["Chrome", "Firefox", "Edge", "Opera", "Brave"],
            variable=self.browser_choice,
            width=110,  # عرض کمتر
            state="normal"
        )
        self.browser_menu.pack(side="left")
        
        # ============ دکمه‌های عملیاتی ============
        action_frame = ctk.CTkFrame(input_frame, fg_color="transparent")
        action_frame.pack(fill="x", padx=15, pady=(5, 12))
        
        # دکمه دریافت اطلاعات
        self.fetch_btn = ctk.CTkButton(
            action_frame,
            text="🔍 دریافت اطلاعات ویدیو",
            command=self.fetch_video_info,
            fg_color="#4361EE",
            hover_color="#3A56D4",
            height=40,  # ارتفاع کمتر
            font=("Tahoma", 12, "bold")  # فونت کوچکتر
        )
        self.fetch_btn.pack(side="left", padx=(0, 8))
        
        # دکمه پاک کردن
        ctk.CTkButton(
            action_frame,
            text="🗑️ پاک کردن",
            command=self.clear_input,
            fg_color="#EF476F",
            hover_color="#D43F63",
            height=40,
            font=self.font_normal
        ).pack(side="left")
        
        # ============ بخش اطلاعات ویدیو ============
        self.info_frame = ctk.CTkFrame(main_content_frame)
        
        # ============ بخش کیفیت‌ها ============
        self.quality_frame = ctk.CTkScrollableFrame(
            main_content_frame,
            label_text="📊 کیفیت‌های موجود",
            height=180,  # ارتفاع کمتر
            scrollbar_button_color="#4CC9F0",
            scrollbar_button_hover_color="#3AA0C7"
        )
        
        # ============ بخش پیشرفت دریافت اطلاعات ============
        self.fetch_progress_frame = ctk.CTkFrame(main_content_frame)
        
        # عنوان بخش دریافت اطلاعات
        fetch_title_frame = ctk.CTkFrame(self.fetch_progress_frame, fg_color="transparent")
        fetch_title_frame.pack(fill="x", padx=12, pady=(8, 3))
        
        ctk.CTkLabel(
            fetch_title_frame,
            text="🔍 پیشرفت دریافت اطلاعات",
            font=("Tahoma", 13, "bold"),  # کوچکتر
            text_color="#FFB347"
        ).pack(side="left")
        
        self.fetch_percent_label = ctk.CTkLabel(
            fetch_title_frame,
            text="0%",
            font=("Tahoma", 11, "bold"),
            text_color="#FFB347"
        )
        self.fetch_percent_label.pack(side="right")
        
        # نوار پیشرفت دریافت
        self.fetch_progress_bar = ctk.CTkProgressBar(
            self.fetch_progress_frame,
            variable=self.fetch_progress_var,
            height=16,  # ارتفاع کمتر
            corner_radius=6,
            progress_color="#FFB347",
            fg_color="#2B2B2B"
        )
        self.fetch_progress_bar.pack(fill="x", padx=12, pady=(0, 3))
        
        # وضعیت دریافت
        self.fetch_status_label = ctk.CTkLabel(
            self.fetch_progress_frame,
            textvariable=self.fetch_status_var,
            font=self.font_small,
            wraplength=750  # عرض کمتر
        )
        self.fetch_status_label.pack(pady=(0, 8))
        
        # ============ بخش پیشرفت دانلود ============
        self.download_progress_frame = ctk.CTkFrame(main_content_frame)
        
        # عنوان بخش دانلود
        download_title_frame = ctk.CTkFrame(self.download_progress_frame, fg_color="transparent")
        download_title_frame.pack(fill="x", padx=12, pady=(8, 3))
        
        ctk.CTkLabel(
            download_title_frame,
            text="⬇️ پیشرفت دانلود",
            font=("Tahoma", 13, "bold"),
            text_color="#06D6A0"
        ).pack(side="left")
        
        self.download_percent_label = ctk.CTkLabel(
            download_title_frame,
            text="0%",
            font=("Tahoma", 11, "bold"),
            text_color="#06D6A0"
        )
        self.download_percent_label.pack(side="right")
        
        # نوار پیشرفت دانلود
        self.download_progress_bar = ctk.CTkProgressBar(
            self.download_progress_frame,
            variable=self.download_progress_var,
            height=16,
            corner_radius=6,
            progress_color="#06D6A0",
            fg_color="#2B2B2B"
        )
        self.download_progress_bar.pack(fill="x", padx=12, pady=(0, 3))
        
        # اطلاعات دانلود
        download_info_frame = ctk.CTkFrame(self.download_progress_frame, fg_color="transparent")
        download_info_frame.pack(fill="x", padx=12, pady=3)
        
        # سرعت دانلود
        speed_frame = ctk.CTkFrame(download_info_frame, fg_color="transparent")
        speed_frame.pack(side="left", fill="x", expand=True)
        
        ctk.CTkLabel(
            speed_frame,
            text="⚡ سرعت:",
            font=self.font_small
        ).pack(side="left")
        
        ctk.CTkLabel(
            speed_frame,
            textvariable=self.download_speed_var,
            font=self.font_small,
            text_color="#4CC9F0"
        ).pack(side="left", padx=(3, 0))
        
        # زمان باقی‌مانده
        time_frame = ctk.CTkFrame(download_info_frame, fg_color="transparent")
        time_frame.pack(side="left", fill="x", expand=True)
        
        ctk.CTkLabel(
            time_frame,
            text="⏱️ زمان:",
            font=self.font_small
        ).pack(side="left")
        
        ctk.CTkLabel(
            time_frame,
            textvariable=self.time_remaining_var,
            font=self.font_small,
            text_color="#4CC9F0"
        ).pack(side="left", padx=(3, 0))
        
        # حجم فایل
        size_frame = ctk.CTkFrame(download_info_frame, fg_color="transparent")
        size_frame.pack(side="left", fill="x", expand=True)
        
        ctk.CTkLabel(
            size_frame,
            text="💾 حجم:",
            font=self.font_small
        ).pack(side="left")
        
        ctk.CTkLabel(
            size_frame,
            textvariable=self.file_size_var,
            font=self.font_small,
            text_color="#4CC9F0"
        ).pack(side="left", padx=(3, 0))
        
        # وضعیت دانلود
        self.download_status_label = ctk.CTkLabel(
            self.download_progress_frame,
            textvariable=self.download_status_var,
            font=self.font_small,
            wraplength=750
        )
        self.download_status_label.pack(pady=(3, 8))
        
        # ============ بخش پیشرفت کلی ============
        self.total_progress_frame = ctk.CTkFrame(main_content_frame)
        
        # عنوان پیشرفت کلی
        total_title_frame = ctk.CTkFrame(self.total_progress_frame, fg_color="transparent")
        total_title_frame.pack(fill="x", padx=12, pady=(8, 3))
        
        ctk.CTkLabel(
            total_title_frame,
            text="📈 پیشرفت کلی",
            font=("Tahoma", 13, "bold"),
            text_color="#7209B7"
        ).pack(side="left")
        
        self.total_percent_label = ctk.CTkLabel(
            total_title_frame,
            text="0%",
            font=("Tahoma", 11, "bold"),
            text_color="#7209B7"
        )
        self.total_percent_label.pack(side="right")
        
        # نوار پیشرفت کلی
        self.total_progress_bar = ctk.CTkProgressBar(
            self.total_progress_frame,
            variable=self.total_progress_var,
            height=20,  # ارتفاع کمتر
            corner_radius=8,
            progress_color="#7209B7",
            fg_color="#2B2B2B",
            border_width=1,  # border نازک‌تر
            border_color="#4A148C"
        )
        self.total_progress_bar.pack(fill="x", padx=12, pady=(0, 3))
        
        # مرحله فعلی
        self.current_stage_label = ctk.CTkLabel(
            self.total_progress_frame,
            textvariable=self.current_stage_var,
            font=self.font_normal
        )
        self.current_stage_label.pack(pady=(3, 8))
        
        # ============ بخش مسیر ذخیره ============
        path_frame = ctk.CTkFrame(main_content_frame)
        path_frame.pack(fill="x", pady=(8, 0))
        
        path_container = ctk.CTkFrame(path_frame, fg_color="transparent")
        path_container.pack(fill="x", padx=15, pady=12)
        
        ctk.CTkLabel(
            path_container,
            text="📂 مسیر ذخیره‌سازی:",
            font=self.font_bold
        ).pack(side="left", padx=(0, 8))
        
        self.path_entry = ctk.CTkEntry(
            path_container,
            textvariable=self.download_path,
            font=self.font_normal
        )
        self.path_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        
        ctk.CTkButton(
            path_container,
            text="مرور",
            command=self.browse_folder,
            width=70,  # عرض کمتر
            font=self.font_normal
        ).pack(side="right")
        
        # ============ دکمه دانلود ============
        self.download_btn = ctk.CTkButton(
            main_content_frame,
            text="⬇️ شروع دانلود",
            command=self.start_download,
            state="disabled",
            fg_color="#06D6A0",
            hover_color="#05C592",
            height=45,  # ارتفاع کمتر
            font=("Tahoma", 14, "bold")  # فونت کوچکتر
        )
        self.download_btn.pack(fill="x", pady=(12, 0))
        
        # مخفی کردن فریم‌های پیشرفت در ابتدا
        self.fetch_progress_frame.pack_forget()
        self.download_progress_frame.pack_forget()
        self.total_progress_frame.pack_forget()
        
        # ============ وضعیت پایین صفحه ============
        status_frame = ctk.CTkFrame(main_content_frame, fg_color="transparent")
        status_frame.pack(fill="x", pady=(10, 5))
        
        self.final_status_label = ctk.CTkLabel(
            status_frame,
            textvariable=self.status_var,
            font=self.font_small,
            text_color="#888888"
        )
        self.final_status_label.pack()
    
    # ==================== متدهای کمکی ====================
    
    def toggle_browser_selection(self):
        """فعال/غیرفعال کردن انتخاب مرورگر"""
        pass
    
    def show_cookie_help(self):
        """نمایش راهنمای کوکی"""
        help_text = """🔐 راهنمای استفاده از کوکی:

1. کوکی‌ها برای دور زدن محدودیت‌های یوتیوب ضروری هستند
2. ابتدا در مرورگر خود به YouTube.com وارد شوید
3. سپس لینک ویدیو را کپی و در برنامه Paste کنید
4. برنامه به طور خودکار کوکی‌ها را از مرورگر شما می‌خواند

⚠️ اگر خطای "Sign in to confirm you're not a bot" دریافت کردید:
• مطمئن شوید در مرورگر وارد یوتیوب شده‌اید
• مرورگر دیگری را امتحان کنید
• VPN خود را خاموش کنید"""
        
        messagebox.showinfo("راهنمای کوکی", help_text)
    
    def paste_from_clipboard(self):
        """چسباندن از کلیپ‌بورد"""
        try:
            text = self.window.clipboard_get()
            if text and ('youtube.com' in text or 'youtu.be' in text):
                self.url_var.set(text.strip())
        except:
            pass
    
    def clear_input(self):
        """پاک کردن همه ورودی‌ها"""
        if self.downloading:
            messagebox.showwarning("هشدار", "لطفاً تا پایان دانلود صبر کنید!")
            return
        
        self.url_var.set("")
        self.reset_app()
        
        # پنهان کردن فریم‌ها
        for frame in [self.info_frame, self.quality_frame, 
                     self.fetch_progress_frame, self.download_progress_frame,
                     self.total_progress_frame]:
            if frame.winfo_ismapped():
                frame.pack_forget()
        
        self.status_var.set("آماده")
    
    def browse_folder(self):
        """انتخاب پوشه ذخیره‌سازی"""
        folder = filedialog.askdirectory()
        if folder:
            self.download_path.set(folder)
    
    def is_valid_youtube_url(self, url):
        """بررسی معتبر بودن لینک یوتیوب"""
        url = url.strip()
        if not url:
            return False
        
        patterns = [
            r'^(https?://)?(www\.)?youtube\.com/watch\?v=',
            r'^(https?://)?(www\.)?youtu\.be/',
            r'^(https?://)?(www\.)?youtube\.com/shorts/',
            r'^(https?://)?(www\.)?youtube\.com/playlist\?',
            r'^(https?://)?(www\.)?music\.youtube\.com/'
        ]
        
        for pattern in patterns:
            if re.search(pattern, url, re.IGNORECASE):
                return True
        
        return False
    
    def get_cookies_from_browser(self):
        """دریافت کوکی‌ها از مرورگر"""
        if not self.use_cookies.get():
            return None
        
        try:
            browser = self.browser_choice.get().lower()
            
            browser_map = {
                'chrome': 'chrome',
                'firefox': 'firefox', 
                'edge': 'edge',
                'opera': 'opera',
                'brave': 'brave'
            }
            
            if browser not in browser_map:
                browser = 'chrome'
            
            print(f"دریافت کوکی از مرورگر: {browser}")
            
            cookies = getattr(browser_cookie3, browser_map[browser])(
                domain_name='.youtube.com'
            )
            
            if not cookies:
                print("هیچ کوکی یافت نشد!")
                return None
            
            # ایجاد فایل کوکی
            temp_file = tempfile.NamedTemporaryFile(
                mode='w',
                delete=False,
                suffix='.txt',
                encoding='utf-8'
            )
            
            temp_file.write("# Netscape HTTP Cookie File\n")
            temp_file.write("# This file is generated by YouTube Downloader\n")
            temp_file.write("# https://www.youtube.com\n\n")
            
            count = 0
            for cookie in cookies:
                if '.youtube.com' in cookie.domain or 'youtube.com' in cookie.domain:
                    is_domain = "TRUE" if cookie.domain.startswith('.') else "FALSE"
                    secure = "TRUE" if cookie.secure else "FALSE"
                    expires = str(cookie.expires) if cookie.expires else "0"
                    
                    line = f"{cookie.domain}\t{is_domain}\t{cookie.path}\t"
                    line += f"{secure}\t{expires}\t{cookie.name}\t{cookie.value}\n"
                    
                    temp_file.write(line)
                    count += 1
            
            temp_file.close()
            print(f"{count} کوکی یوتیوب ذخیره شد.")
            
            return temp_file.name
            
        except Exception as e:
            print(f"خطا در دریافت کوکی: {e}")
            traceback.print_exc()
            return None
    
    # ==================== متدهای پیشرفت ====================
    
    def update_fetch_progress(self, percent, status):
        """به‌روزرسانی پیشرفت دریافت اطلاعات"""
        self.fetch_progress_var.set(percent / 100)
        self.fetch_status_var.set(status)
        self.fetch_percent_label.configure(text=f"{int(percent)}%")
        
        # به‌روزرسانی پیشرفت کلی (0% تا 30%)
        overall_percent = percent * 0.3
        self.update_total_progress(overall_percent, "دریافت اطلاعات")
        
        # نمایش فریم اگر مخفی است
        if not self.fetch_progress_frame.winfo_ismapped():
            self.fetch_progress_frame.pack(fill="x", pady=(8, 5))
    
    def update_download_progress(self, percent, speed="", eta="", size_info=""):
        """به‌روزرسانی پیشرفت دانلود"""
        self.download_progress_var.set(percent / 100)
        self.download_percent_label.configure(text=f"{int(percent)}%")
        
        if speed:
            self.download_speed_var.set(speed)
        if eta:
            self.time_remaining_var.set(eta)
        if size_info:
            self.file_size_var.set(size_info)
        
        # به‌روزرسانی وضعیت دانلود
        if percent < 30:
            status = f"شروع دانلود... {percent}%"
        elif percent < 70:
            status = f"در حال دانلود... {percent}%"
        elif percent < 95:
            status = f"پایان نزدیک... {percent}%"
        else:
            status = f"نهایی‌سازی... {percent}%"
        
        self.download_status_var.set(status)
        
        # به‌روزرسانی پیشرفت کلی (30% تا 90%)
        overall_percent = 30 + (percent * 0.6)
        self.update_total_progress(overall_percent, "در حال دانلود")
        
        # نمایش فریم اگر مخفی است
        if not self.download_progress_frame.winfo_ismapped():
            self.download_progress_frame.pack(fill="x", pady=(8, 5))
    
    def update_total_progress(self, percent, stage):
        """به‌روزرسانی پیشرفت کلی"""
        if percent > 100:
            percent = 100
        
        self.total_progress_var.set(percent / 100)
        self.total_percent_label.configure(text=f"{int(percent)}%")
        self.current_stage_var.set(f"مرحله: {stage}")
        
        # تغییر رنگ بر اساس درصد
        if percent < 30:
            color = "#EF476F"
        elif percent < 60:
            color = "#FFB347"
        elif percent < 90:
            color = "#06D6A0"
        else:
            color = "#7209B7"
        
        self.total_progress_bar.configure(progress_color=color)
        
        # نمایش فریم اگر مخفی است
        if not self.total_progress_frame.winfo_ismapped():
            self.total_progress_frame.pack(fill="x", pady=(8, 5))
    
    def simulate_fetch_stages(self):
        """شبیه‌سازی مراحل دریافت اطلاعات"""
        stages = [
            (10, "برقراری ارتباط با سرور..."),
            (25, "دریافت اطلاعات اولیه..."),
            (45, "استخراج اطلاعات ویدیو..."),
            (65, "آنالیز کیفیت‌های موجود..."),
            (85, "پردازش اطلاعات..."),
            (100, "✅ اطلاعات با موفقیت دریافت شد")
        ]
        
        for percent, status in stages:
            self.window.after(0, self.update_fetch_progress, percent, status)
            time.sleep(0.8)
    
    # ==================== متدهای اصلی ====================
    
    def fetch_video_info(self):
        """دریافت اطلاعات ویدیو"""
        if self.fetching or self.downloading:
            messagebox.showwarning("هشدار", "لطفاً تا پایان عملیات فعلی صبر کنید!")
            return
        
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning("خطا", "لطفاً لینک ویدیو را وارد کنید!")
            return
        
        if not self.is_valid_youtube_url(url):
            messagebox.showerror("خطا", "⚠️ لینک وارد شده معتبر نیست!")
            return
        
        # بازنشانی پیشرفت‌ها
        self.update_fetch_progress(0, "شروع دریافت اطلاعات...")
        self.update_download_progress(0, "", "", "")
        self.update_total_progress(0, "آماده")
        
        self.fetching = True
        self.fetch_btn.configure(state="disabled", text="⏳ در حال دریافت...")
        self.status_var.set("در حال دریافت اطلاعات از یوتیوب...")
        
        threading.Thread(target=self._fetch_info_thread, args=(url,), daemon=True).start()
    
    def _fetch_info_thread(self, url):
        """رشته دریافت اطلاعات"""
        cookie_file = None
        self.fetch_start_time = datetime.now()
        
        try:
            # شبیه‌سازی مراحل دریافت (برای نمایش پیشرفت)
            threading.Thread(target=self.simulate_fetch_stages, daemon=True).start()
            
            # دریافت کوکی‌ها
            if self.use_cookies.get():
                cookie_file = self.get_cookies_from_browser()
            
            # تنظیمات yt-dlp
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'cookiefile': cookie_file,
                'socket_timeout': 60,
                'extract_flat': False,
                'ignoreerrors': True,
                'verbose': False,
                'geo_bypass': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            with youtube_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False, process=False)
                info = ydl.process_ie_result(info, download=False)
                self.video_info = info
                self.formats = info.get('formats', [])
                
                self.window.after(0, self._display_video_info)
                
        except youtube_dlp.utils.DownloadError as e:
            if "Sign in" in str(e) or "confirm you're not a bot" in str(e):
                self.window.after(0, self._handle_auth_error)
            else:
                error_msg = str(e)[:150]
                self.window.after(0, lambda: messagebox.showerror("❌ خطا در دریافت", error_msg))
                self.window.after(0, self._reset_fetch_state)
        except Exception as e:
            error_msg = str(e)[:150]
            self.window.after(0, lambda: messagebox.showerror("❌ خطا", error_msg))
            self.window.after(0, self._reset_fetch_state)
            
        finally:
            if cookie_file and os.path.exists(cookie_file):
                try:
                    os.unlink(cookie_file)
                except:
                    pass
    
    def _handle_auth_error(self):
        """مدیریت خطای احراز هویت"""
        messagebox.showwarning(
            "⚠️ نیاز به تأیید هویت",
            "یوتیوب نیاز به تأیید هویت دارد!\n\n"
            "لطفاً:\n"
            "1. مرورگر خود را باز کنید\n"
            "2. به YouTube.com وارد شوید\n"
            "3. کوکی‌ها را در برنامه فعال کنید\n"
            "4. دوباره امتحان کنید"
        )
        self._reset_fetch_state()
    
    def _display_video_info(self):
        """نمایش اطلاعات ویدیو"""
        try:
            # نمایش فریم اطلاعات
            self.info_frame.pack(fill="x", pady=(8, 5))
            
            # پاک کردن محتوای قبلی
            for widget in self.info_frame.winfo_children():
                widget.destroy()
            
            # اطلاعات ویدیو
            title = self.video_info.get('title', 'بدون عنوان')
            uploader = self.video_info.get('uploader', 'ناشناس')
            duration = self.video_info.get('duration', 0)
            views = self.video_info.get('view_count', 0)
            
            # قالب‌بندی
            if duration > 0:
                duration_str = str(timedelta(seconds=duration))
                if duration_str.startswith("0:"):
                    duration_str = duration_str[2:]
            else:
                duration_str = "نامشخص"
            
            if views > 0:
                if views >= 1000000:
                    views_str = f"{views/1000000:.1f}M"
                elif views >= 1000:
                    views_str = f"{views/1000:.1f}K"
                else:
                    views_str = str(views)
            else:
                views_str = "نامشخص"
            
            # نمایش
            ctk.CTkLabel(
                self.info_frame,
                text=f"🎬 {title[:100]}",  # کوتاه‌تر
                font=self.font_title,
                wraplength=800  # عرض کمتر
            ).pack(pady=(8, 3))
            
            info_text = f"👤 آپلودکننده: {uploader} | ⏱ مدت: {duration_str} | 👁️ بازدید: {views_str}"
            ctk.CTkLabel(
                self.info_frame,
                text=info_text,
                font=self.font_normal,
                text_color="#888888"
            ).pack(pady=(0, 8))
            
            # نمایش کیفیت‌ها
            self._display_quality_options()
            
            # به‌روزرسانی نهایی پیشرفت
            self.update_total_progress(100, "اطلاعات دریافت شد")
            self.status_var.set("✅ اطلاعات با موفقیت دریافت شد. کیفیت را انتخاب کنید.")
            
        except Exception as e:
            print(f"خطا در نمایش: {e}")
        finally:
            self._reset_fetch_state()
    
    def _display_quality_options(self):
        """نمایش گزینه‌های کیفیت"""
        if self.quality_frame.winfo_ismapped():
            self.quality_frame.pack_forget()
        
        for widget in self.quality_frame.winfo_children():
            widget.destroy()
        
        # جدا کردن فرمت‌ها
        video_formats = []
        audio_formats = []
        
        for fmt in self.formats:
            if fmt.get('vcodec') != 'none' and fmt.get('acodec') != 'none':
                video_formats.append(fmt)
            elif fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none':
                audio_formats.append(fmt)
        
        # مرتب‌سازی
        video_formats.sort(key=lambda x: x.get('height', 0) or 0)
        audio_formats.sort(key=lambda x: x.get('abr', 0) or 0)
        
        # متغیر رادیو
        self.format_var = ctk.StringVar(value="")
        
        # نمایش فرمت‌های ویدیویی
        if video_formats:
            ctk.CTkLabel(
                self.quality_frame,
                text="🎥 فرمت‌های ویدیویی:",
                font=("Tahoma", 13, "bold"),
                text_color="#4CC9F0"
            ).pack(anchor="w", padx=15, pady=(12, 5))
            
            # محدود کردن تعداد نمایش
            for fmt in video_formats[-12:]:  # 12 کیفیت آخر (کمتر شده)
                desc = self._format_description(fmt)
                rb = ctk.CTkRadioButton(
                    self.quality_frame,
                    text=desc,
                    variable=self.format_var,
                    value=fmt['format_id'],
                    command=self._enable_download_btn,
                    font=self.font_normal
                )
                rb.pack(anchor="w", padx=30, pady=1)  # padding کمتر
        
        # نمایش فرمت‌های صوتی
        if audio_formats:
            ctk.CTkLabel(
                self.quality_frame,
                text="🎵 فرمت‌های صوتی:",
                font=("Tahoma", 13, "bold"),
                text_color="#4CC9F0"
            ).pack(anchor="w", padx=15, pady=(10, 5))
            
            for fmt in audio_formats[-4:]:  # 4 کیفیت آخر
                desc = self._format_description(fmt)
                rb = ctk.CTkRadioButton(
                    self.quality_frame,
                    text=desc,
                    variable=self.format_var,
                    value=fmt['format_id'],
                    command=self._enable_download_btn,
                    font=self.font_normal
                )
                rb.pack(anchor="w", padx=30, pady=1)
        
        # نمایش فریم
        self.quality_frame.pack(fill="both", expand=True, pady=(0, 8))
    
    def _format_description(self, fmt):
        """تولید توضیحات فرمت"""
        if fmt.get('vcodec') != 'none':
            # ویدیو
            height = fmt.get('height', '?')
            ext = fmt.get('ext', 'mp4').upper()
            fps = fmt.get('fps', 0)
            fps_str = f" ({fps}fps)" if fps and fps > 30 else ""
            
            # حجم
            size = fmt.get('filesize') or fmt.get('filesize_approx')
            if size:
                if size > 1024*1024*1024:
                    size_str = f" {size/(1024*1024*1024):.1f}GB"  # کوتاه‌تر
                else:
                    size_str = f" {size/(1024*1024):.0f}MB"
            else:
                size_str = ""
            
            return f"{height}p • {ext}{fps_str}{size_str}"
        else:
            # صوتی
            abr = fmt.get('abr', 0)
            ext = fmt.get('ext', 'mp3').upper()
            
            size = fmt.get('filesize')
            if size:
                size_str = f" {size/(1024*1024):.0f}MB"
            else:
                size_str = ""
            
            return f"صوتی • {abr}kbps • {ext}{size_str}"
    
    def _enable_download_btn(self):
        """فعال کردن دکمه دانلود"""
        self.selected_format = self.format_var.get()
        if self.selected_format:
            self.download_btn.configure(state="normal", fg_color="#06D6A0")
            self.download_status_var.set("✅ کیفیت انتخاب شد")
            self.update_total_progress(30, "آماده برای دانلود")
            self.status_var.set("کیفیت انتخاب شد. آماده دانلود!")
    
    def _reset_fetch_state(self):
        """بازنشانی وضعیت دریافت"""
        self.fetching = False
        self.fetch_btn.configure(state="normal", text="🔍 دریافت اطلاعات ویدیو")
    
    def progress_hook(self, d):
        """هوک پیشرفت دانلود برای yt-dlp"""
        if not self.downloading:
            return
            
        if d['status'] == 'downloading':
            # استخراج درصد
            percent_str = d.get('_percent_str', '0%').replace('%', '').strip()
            try:
                percent = float(percent_str)
            except:
                percent = 0
            
            # استخراج اطلاعات
            speed = d.get('_speed_str', 'N/A')
            eta = d.get('_eta_str', 'N/A')
            downloaded = d.get('_downloaded_bytes_str', '0')
            total = d.get('_total_bytes_str', '?')
            
            # به‌روزرسانی UI
            size_info = f"{downloaded} / {total}"
            self.window.after(0, self.update_download_progress, percent, speed, eta, size_info)
                
        elif d['status'] == 'finished':
            self.window.after(0, lambda: self.update_download_progress(100, "کامل", "0", "کامل"))
            self.window.after(0, lambda: self.update_total_progress(100, "دانلود کامل"))
    
    def start_download(self):
        """شروع دانلود"""
        if self.downloading or not self.selected_format:
            return
        
        url = self.url_var.get().strip()
        path = self.download_path.get().strip()
        
        if not url or not self.is_valid_youtube_url(url):
            messagebox.showerror("خطا", "لطفاً یک لینک معتبر وارد کنید!")
            return
        
        if not os.path.exists(path):
            try:
                os.makedirs(path)
            except Exception as e:
                messagebox.showerror("خطا", f"خطا در ایجاد پوشه:\n{str(e)}")
                return
        
        # بازنشانی پیشرفت دانلود
        self.update_download_progress(0, "", "", "")
        self.update_total_progress(30, "شروع دانلود")
        
        self.downloading = True
        self.download_btn.configure(state="disabled", text="⏳ در حال دانلود...")
        self.download_start_time = datetime.now()
        self.status_var.set("در حال دانلود...")
        
        threading.Thread(target=self._download_thread, args=(url, path), daemon=True).start()
    
    def _download_thread(self, url, path):
        """رشته دانلود"""
        cookie_file = None
        try:
            # دریافت کوکی‌ها
            if self.use_cookies.get():
                cookie_file = self.get_cookies_from_browser()
            
            # تنظیمات yt-dlp
            ydl_opts = {
                'format': self.selected_format,
                'outtmpl': os.path.join(path, '%(title)s.%(ext)s'),
                'progress_hooks': [self.progress_hook],
                'cookiefile': cookie_file,
                'quiet': True,
                'no_warnings': True,
                'socket_timeout': 60,
                'retries': 10,
                'fragment_retries': 10,
                'continuedl': True,
                'noprogress': True,
                'geo_bypass': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'merge_output_format': 'mp4',
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }] if self.selected_format and 'video' in self.selected_format else []
            }
            
            print(f"شروع دانلود با فرمت: {self.selected_format}")
            
            with youtube_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            # محاسبه زمان کل دانلود
            time_str = "نامشخص"
            if self.download_start_time:
                total_time = datetime.now() - self.download_start_time
                time_str = str(total_time).split('.')[0]
            
            self.window.after(0, lambda: messagebox.showinfo(
                "🎉 دانلود کامل!",
                f"✅ ویدیو با موفقیت دانلود شد!\n\n"
                f"📁 مسیر: {path}\n"
                f"⏱️ زمان کل: {time_str}\n\n"
                f"لذت ببرید! 😊"
            ))
            
        except Exception as e:
            error_msg = str(e)[:200]
            print(f"خطای دانلود: {traceback.format_exc()}")
            
            self.window.after(0, lambda: messagebox.showerror(
                "❌ خطا در دانلود",
                f"خطا در فرآیند دانلود:\n{error_msg}\n\n"
                f"راه‌حل‌ها:\n"
                f"1. اینترنت خود را بررسی کنید\n"
                f"2. کوکی‌ها را فعال کنید\n"
                f"3. کیفیت دیگری انتخاب کنید"
            ))
            
        finally:
            if cookie_file and os.path.exists(cookie_file):
                try:
                    os.unlink(cookie_file)
                except:
                    pass
            self.window.after(0, self.reset_app)
    
    def reset_app(self):
        """بازنشانی کامل برنامه"""
        self.downloading = False
        self.fetching = False
        self.selected_format = None
        
        self.download_btn.configure(state="disabled", text="⬇️ شروع دانلود")
        self.fetch_btn.configure(state="normal", text="🔍 دریافت اطلاعات ویدیو")
        
        # بازنشانی متغیرهای پیشرفت
        self.fetch_status_var.set("آماده برای دریافت اطلاعات")
        self.download_status_var.set("آماده برای دانلود")
        self.download_speed_var.set("--")
        self.time_remaining_var.set("--:--")
        self.file_size_var.set("-- / --")
        self.current_stage_var.set("مرحله: آماده")
        
        self.status_var.set("آماده")
        
        # پنهان کردن فریم‌ها
        for frame in [self.info_frame, self.quality_frame]:
            if frame.winfo_ismapped():
                frame.pack_forget()
    
    def run(self):
        """اجرای برنامه"""
        try:
            self.window.mainloop()
        except KeyboardInterrupt:
            print("\n⏹️ برنامه توسط کاربر متوقف شد.")
        except Exception as e:
            print(f"❌ خطای غیرمنتظره: {e}")
            traceback.print_exc()

# ============================================
# راه‌اندازی
# ============================================
if __name__ == "__main__":
    print("=" * 50)
    print("🎬 دانلودر پیشرفته یوتیوب با نوار پیشرفت")
    print("=" * 50)
    
    try:
        app = YouTubeDownloaderApp()
        print("✅ برنامه با موفقیت راه‌اندازی شد!")
        print("💡 نکته: برای بهترین نتیجه، در مرورگر به YouTube.com وارد شوید.")
        app.run()
        
    except Exception as e:
        print(f"❌ خطای بحرانی: {e}")
        traceback.print_exc()
        
        # نمایش خطا در MessageBox
        try:
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "خطای بحرانی", 
                f"برنامه نمی‌تواند اجرا شود:\n\n{str(e)}\n\n"
                f"لطفاً CustomTkinter را نصب کنید:\n"
                f"pip install customtkinter"
            )
            root.destroy()
        except:
            pass
        
        input("\nبرای خروج Enter بزنید...")
