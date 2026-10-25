"""
TubeX — Modern YouTube Downloader
PySide6 GUI + yt-dlp + Aether tunnel
Author: Mohammad-Hasan Kaman
"""
import sys, os, asyncio, threading, time, json, tempfile, urllib.request, zipfile, socket
from pathlib import Path

from PySide6.QtCore import QObject, Signal, QSettings
from PySide6.QtGui import QFont

APP_NAME = "TubeX"
APP_DIR = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / APP_NAME
DOWNLOADS_DIR = Path.home() / "Downloads"
AETHER_DIR = APP_DIR / "aether"
YTDL_DIR = APP_DIR / "yt-dlp"
HISTORY_FILE = APP_DIR / "history.json"
SETTINGS = QSettings(APP_NAME, APP_NAME)
FONT_NAME = "Vazirmatn"

for d in [APP_DIR, AETHER_DIR, YTDL_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def fmt_size(n):
    if not n: return "0 B"
    for u in ("B","KB","MB","GB"):
        if abs(n)<1024: return f"{n:.1f} {u}"
        n/=1024
    return f"{n:.1f} TB"

def parse_url(text):
    text=text.strip()
    if text.startswith("youtu.be/") or text.startswith("http"): return text
    if len(text)==11: return f"https://www.youtube.com/watch?v={text}"
    return text or None

class TunnelManager(QObject):
    status_changed = Signal(int)   # 0=off,1=check,2=direct,3=tunnel,4=error
    log_signal = Signal(str)
    def __init__(self, parent=None):
        super().__init__(parent)
        self._proc=None; self._port=1819
        self._aether_bin=None; self._yt_dl_bin=None; self._ffmpeg_bin=None
        self._proxy_used=False
    @property
    def proxy_url(self):
        return f"socks5h://127.0.0.1:{self._port}" if self._proxy_used else ""
    @property
    def is_tunnel_active(self): return self._proxy_used

    def get_aether_binary(self):
        if self._aether_bin is None:
            c = AETHER_DIR / "aether.exe"
            self._aether_bin = c if c.exists() else None
        return self._aether_bin
    def get_yt_dlp_binary(self):
        if self._yt_dl_bin is None:
            self._yt_dl_bin = YTDL_DIR / "yt-dlp.exe"
        return self._yt_dl_bin if self._yt_dl_bin.exists() else None
    def get_ffmpeg_binary(self):
        if self._ffmpeg_bin is None:
            self._ffmpeg_bin = YTDL_DIR / "ffmpeg.exe"
        return self._ffmpeg_bin if self._ffmpeg_bin.exists() else None

    def test_direct(self, timeout=5):
        try:
            req = urllib.request.Request("https://www.youtube.com",
                headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status==200
        except Exception: return False

    def ensure_tunnel(self):
        """Always start Aether tunnel (zero user action needed)."""
        self.log_signal.emit("راه‌اندازی تونل Aether...")
        self.status_changed.emit(1)
        aether_bin = self._ensure_aether()
        self._ensure_ytdlp()
        self._ensure_ffmpeg()
        if not aether_bin:
            self.log_signal.emit("خطا: دانلود Aether ناموفق بود. فقط دانلود مستقیم.")
            self.status_changed.emit(4)
            return False
        return self.start_tunnel(aether_bin)

    def _ensure_aether(self):
        bp = AETHER_DIR / "aether.exe"
        if bp.exists(): return bp
        self.log_signal.emit("در حال دانلود Aether...")
        try:
            url="https://github.com/CluvexStudio/Aether/releases/latest/download/aether-windows-x86_64.zip"
            req = urllib.request.Request(url,headers={"User-Agent":"TubeX/1.0"})
            with urllib.request.urlopen(req,timeout=30) as resp: data=resp.read()
            z = AETHER_DIR / "aether.zip"; z.write_bytes(data)
            with zipfile.ZipFile(z) as zf:
                for n in zf.namelist():
                    if "aether.exe" in n.lower():
                        out = AETHER_DIR / "aether.exe"
                        out.write_bytes(zf.read(n)); self._aether_bin=out
                        z.unlink(missing_ok=True); break
            return self._aether_bin
        except Exception as e:
            self.log_signal.emit(f"خطای Aether: {e}")
            return None

    def _ensure_ytdlp(self):
        bp = YTDL_DIR / "yt-dlp.exe"
        if bp.exists(): return bp
        self.log_signal.emit("در حال دانلود yt-dlp...")
        try:
            url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
            req = urllib.request.Request(url,headers={"User-Agent":"TubeX/1.0"})
            with urllib.request.urlopen(req,timeout=60) as resp: data=resp.read()
            bp.write_bytes(data); bp.chmod(0o755); self._yt_dl_bin=bp
            return bp
        except Exception as e:
            self.log_signal.emit(f"خطای yt-dlp: {e}"); return None

    def _ensure_ffmpeg(self):
        bp = YTDL_DIR / "ffmpeg.exe"
        if bp.exists(): return bp
        self.log_signal.emit("در حال دانلود FFmpeg...")
        try:
            url=("https://github.com/gyan/ffmpeg-builds/releases/download/"
                 "8.1/ffmpeg-8.1-full_build.zip")
            req = urllib.request.Request(url,headers={"User-Agent":"TubeX/1.0"})
            with urllib.request.urlopen(req,timeout=120) as resp: data=resp.read()
            z = YTDL_DIR / "ffmpeg.zip"; z.write_bytes(data)
            with zipfile.ZipFile(z) as zf:
                for n in zf.namelist():
                    if "ffmpeg.exe" in n.lower() and "/" in n:
                        out = YTDL_DIR / "ffmpeg.exe"
                        out.write_bytes(zf.read(n)); out.chmod(0o755); self._ffmpeg_bin=out
                        break
            z.unlink(missing_ok=True)
            self.log_signal.emit("FFmpeg آماده شد.")
        except Exception as e:
            self.log_signal.emit(f"خطای FFmpeg: {e}")

    def start_tunnel(self, aether_bin):
        if self._proc is not None: return True
        try:
            import subprocess
            self._proc = subprocess.Popen(
                [str(aether_bin), "--masque","-4",
                 "--scan","balanced","--noize","firewall",
                 f"--bind","127.0.0.1:{self._port}",
                 "--quick-reconnect"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=str(AETHER_DIR))
            self._wait_proxy()
        except Exception as e:
            self.log_signal.emit(f"خطای راه‌اندازی: {e}")
            self._proc=None; return False
        return True

    def _wait_proxy(self, timeout=20):
        start=time.time()
        while time.time()-start < timeout:
            try:
                s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
                s.settimeout(0.5)
                s.connect(("127.0.0.1",self._port)); s.close()
                self._proxy_used=True; self.status_changed.emit(3)
                self.log_signal.emit("تونل فعال شد.")
                return
            except: time.sleep(0.5)
        if self._proc: self._proc.terminate()
        self._proc=None; self.log_signal.emit("خطا: اتصال تونل برقرار نشد.")
        self.status_changed.emit(4)

    def stop_tunnel(self):
        if self._proc: self._proc.terminate(); self._proc=None
        self._proxy_used=False; self.status_changed.emit(0)
