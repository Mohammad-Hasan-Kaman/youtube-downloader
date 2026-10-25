"""
DownloadWorker — runs yt-dlp in background with progress callbacks
"""
import yt_dlp
from pathlib import Path
from PySide6.QtCore import QObject, Signal


class DownloadWorker(QObject):
    info_fetched = Signal(dict)
    progress_update = Signal(float, str, int)  # pct, speed, bytes
    status_msg = Signal(str)
    finished = Signal(bool, dict)
    error = Signal(str)

    def __init__(self, tunnel, parent=None):
        super().__init__(parent)
        self.tunnel = tunnel
        self._ffmpeg = tunnel.get_ffmpeg_binary()

    def _build_opts(self, fmt, out_dir, sub_lang="", thumb=False):
        opts = {
            "outtmpl": str(out_dir / "%(title)s.%(ext)s"),
            "format": fmt,
            "quiet": False, "no_warnings": False,
            "merge_output_format": "mp4",
            "progress_with_title": True, "noplaylist": False,
            "writethumbnail": thumb, "simulate": False,
            "extract_flat": False,
        }
        if self._ffmpeg:
            opts["ffmpeg_location"] = str(self._ffmpeg.parent)
        if sub_lang:
            opts["writesubtitles"] = True
            opts["subtitleslangs"] = [sub_lang]
            opts["subtitlesformat"] = "srt/best"
        # Try browser cookies first (bypasses bot detection)
        # Note: browser_cookie3 requires admin on Windows Chrome 130+
        try:
            import browser_cookie3
            for browser in ("chrome", "firefox", "edge", "brave"):
                try:
                    opts["cookies"] = browser_cookie3.browser(browser)
                    break
                except Exception:
                    pass
        except ImportError:
            pass  # browser_cookie3 not available
        proxy = self.tunnel.proxy_url
        if proxy:
            opts["proxy"] = proxy
        return opts

    def fetch_info(self, url):
        opts = self._build_opts("*", Path(__import__("tempfile").gettempdir()), thumb=True)
        opts["skip_download"] = True; opts["quiet"] = True
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            return info
        except Exception as e:
            self.error.emit(str(e)); return None

    def download(self, url, fmt, out_dir, sub_lang="", thumb=False, progress_cb=None):
        opts = self._build_opts(fmt, out_dir, sub_lang=sub_lang, thumb=thumb)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.add_progress_hook(self._hook)
                info = ydl.extract_info(url, download=True)
            self.finished.emit(True, info or {})
        except Exception as e:
            self.error.emit(str(e))

    def _hook(self, d):
        if d["status"] == "downloading":
            downloaded = d.get("downloaded_bytes", 0) or 0
            total = d.get("total_bytes", 0) or d.get("total_bytes_estimate", 0) or 1
            pct = (downloaded / total) * 100 if total else 0
            speed = d.get("speed", 0) or 0
            self.progress_update.emit(pct, f"{speed:.1f} KB/s", downloaded)
        elif d["status"] == "finished":
            self.status_msg.emit("دانلود تکمیل شد ✓")
