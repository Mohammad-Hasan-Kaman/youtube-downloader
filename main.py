"""
TubeX — Main Application
Modern YouTube downloader with Aether tunnel
"""
import sys, os, json, time, threading
from pathlib import Path
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QComboBox, QGroupBox,
    QProgressBar, QFrame, QScrollArea, QMessageBox, QFileDialog,
    QTextEdit, QListWidget, QListWidgetItem, QSplitter, QCheckBox,
)
from PySide6.QtCore import Qt, QSize, QTimer, Signal, QThread, QObject, QSettings
from PySide6.QtGui import QFont, QIcon, QPixmap, QColor, QLinearGradient, QPainter, QBrush, QKeySequence

import yt_dlp

sys.path.insert(0, str(Path(__file__).parent))
from tunnel import (
    TunnelManager, APP_DIR, APP_NAME, DOWNLOADS_DIR, HISTORY_FILE,
    SETTINGS, fmt_size, parse_url, FONT_NAME,
)
from worker import DownloadWorker


# ─── Font Setup ──────────────────────────────────────────────────────────────
def _install_persian_font():
    """Auto-install Vazirmatn font if missing (Windows)."""
    import urllib.request, zipfile, os
    win_fonts = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts")
    target = os.path.join(win_fonts, "Vazirmatn-Regular.ttf")
    if os.path.exists(target):
        return True
    # Download from GitHub releases (latest release asset)
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/rastikerdar/vazirmatn/releases/latest",
            headers={"User-Agent": "TubeX/1.0"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        asset_url = None
        for a in data.get("assets", []):
            if "Regular" in a["name"] and a["name"].endswith(".ttf"):
                asset_url = a["browser_download_url"]
                break
        if not asset_url:
            # fallback: try to get any ttf from assets
            for a in data.get("assets", []):
                if a["name"].endswith(".ttf"):
                    asset_url = a["browser_download_url"]
                    break
        if not asset_url:
            return False
        # Download the font file
        out = Path(target)
        req2 = urllib.request.Request(asset_url, headers={"User-Agent": "TubeX/1.0"})
        with urllib.request.urlopen(req2, timeout=60) as r:
            out.write_bytes(r.read())
        out.chmod(0o644)
        return True
    except Exception:
        return False

# Run font install in background (non-blocking)
_thread = threading.Thread(target=_install_persian_font, daemon=True)
_thread.start()


# ─── Helpers ────────────────────────────────────────────────────────────────
def load_history():
    try:
        if HISTORY_FILE.exists():
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def save_history(h):
    try:
        HISTORY_FILE.write_text(json.dumps(h, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TubeX — YouTube Downloader")
        self.setMinimumSize(860, 640)
        self._tunnel = TunnelManager(self)
        self._worker = DownloadWorker(self._tunnel)
        self._history = load_history()
        self._thumb_path = None
        self._current_info = None
        self._video_formats = []
        self._audio_formats = []
        self._setting_save_dir = DOWNLOADS_DIR

        self._setup_ui()
        self._connect_signals()
        self._apply_stylesheet()
        self._update_status(0)
        self._populate_history()

        # Start tunnel check after UI is built
        QTimer.singleShot(300, self._check_tunnel)

    # ─── UI Setup ──────────────────────────────────────────────────────────
    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Header
        header = QHBoxLayout()
        header.setSpacing(16)

        self._title_lbl = QLabel("▶ TubeX")
        self._title_lbl.setObjectName("title_label")
        header.addWidget(self._title_lbl)

        header.addStretch()

        self._status_lbl = QLabel("● بررسی اتصال...")
        self._status_lbl.setObjectName("status_indicator")
        header.addWidget(self._status_lbl)

        layout.addLayout(header)
        layout.addSpacing(4)

        # Input card
        self._input_card = self._make_card("آدرس ویدیو")
        inp_layout = QVBoxLayout(self._input_card)
        inp_layout.setSpacing(8)

        self._url_edit = QLineEdit()
        self._url_edit.setPlaceholderText("https://www.youtube.com/watch?v=... یا کد ویدیو را وارد کنید")
        self._url_edit.setMinimumHeight(44)
        inp_layout.addWidget(self._url_edit)

        row2 = QHBoxLayout()
        row2.setSpacing(8)
        btn_fetch = QPushButton("دریافت اطلاعات")
        btn_fetch.setObjectName("btn_fetch")
        btn_fetch.clicked.connect(self._on_fetch_info)
        row2.addWidget(btn_fetch)

        btn_dir = QPushButton("📁 تغییر پوشه")
        btn_dir.clicked.connect(self._change_dir)
        row2.addWidget(btn_dir)

        lbl_dir = QLabel(str(self._setting_save_dir))
        lbl_dir.setTextInteractionFlags(Qt.TextSelectableByMouse)
        lbl_dir.setStyleSheet("color: #60a5fa; font-size: 11px;")
        row2.addWidget(lbl_dir, 1)

        inp_layout.addLayout(row2)
        layout.addWidget(self._input_card)

        # Format selection card
        self._fmt_card = self._make_card("فرمت دانلود")
        fmt_layout = QVBoxLayout(self._fmt_card)
        fmt_layout.setSpacing(8)

        # Tabs for video / audio
        tab_row = QHBoxLayout()
        tab_row.setSpacing(6)
        self._tab_btn_video = QPushButton("🎬 ویدیو")
        self._tab_btn_audio = QPushButton("🎵 صدا")
        self._tab_btn_video.setObjectName("btn_tab")
        self._tab_btn_audio.setObjectName("btn_tab")
        self._tab_btn_video.clicked.connect(lambda: self._switch_tab("video"))
        self._tab_btn_audio.clicked.connect(lambda: self._switch_tab("audio"))
        tab_row.addWidget(self._tab_btn_video)
        tab_row.addWidget(self._tab_btn_audio)
        tab_row.addStretch()
        fmt_layout.addLayout(tab_row)

        # Video formats
        self._video_grp = QGroupBox("انتخاب کیفیت ویدیو")
        v_layout = QVBoxLayout(self._video_grp)
        v_layout.setSpacing(6)
        self._video_formats_lbl = QLabel("ابتدا «دریافت اطلاعات» را بزنید.")
        self._video_formats_lbl.setWordWrap(True)
        v_layout.addWidget(self._video_formats_lbl)
        fmt_layout.addWidget(self._video_grp)

        # Audio formats
        self._audio_grp = QGroupBox("انتخاب کیفیت صدا")
        self._audio_grp.setVisible(False)
        a_layout = QVBoxLayout(self._audio_grp)
        a_layout.setSpacing(6)
        self._audio_formats_lbl = QLabel("ابتدا «دریافت اطلاعات» را بزنید.")
        self._audio_formats_lbl.setWordWrap(True)
        a_layout.addWidget(self._audio_formats_lbl)
        fmt_layout.addWidget(self._audio_grp)

        # Subtitle & thumbnail
        opts_row = QHBoxLayout()
        opts_row.setSpacing(10)
        lbl_sub = QLabel("زیرنویس:")
        self._sub_combo = QComboBox()
        self._sub_combo.addItems(["بدون", "fa", "en", "zh-Hans", "ar"])
        opts_row.addWidget(lbl_sub)
        opts_row.addWidget(self._sub_combo)
        opts_row.addStretch()
        self._thumb_chk = QCheckBox("دانلود تصویر ویدیو")
        opts_row.addWidget(self._thumb_chk)
        fmt_layout.addLayout(opts_row)

        layout.addWidget(self._fmt_card)

        # Action buttons
        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)
        self._btn_download = QPushButton("⬇ شروع دانلود")
        self._btn_download.setObjectName("btn_download")
        self._btn_download.setEnabled(False)
        self._btn_download.clicked.connect(self._on_download)
        btn_row.addWidget(self._btn_download)

        self._btn_cancel = QPushButton("✋ لغو")
        self._btn_cancel.setObjectName("btn_cancel")
        self._btn_cancel.setEnabled(False)
        self._btn_cancel.clicked.connect(self._cancel_download)
        btn_row.addWidget(self._btn_cancel)

        btn_row.addStretch()
        layout.addLayout(btn_row)

        # Progress section
        prog_card = self._make_card("وضعیت دانلود")
        prog_layout = QVBoxLayout(prog_card)
        prog_layout.setSpacing(6)

        self._progress_lbl = QLabel("")
        self._progress_lbl.setStyleSheet("color:#a0b4d0; font-size:12px;")
        prog_layout.addWidget(self._progress_lbl)

        self._progress_bar = QProgressBar()
        self._progress_bar.setValue(0)
        prog_layout.addWidget(self._progress_bar)

        layout.addWidget(prog_card)

        # Log + History split
        splitter = QSplitter(Qt.Vertical)
        splitter.setHandleWidth(6)

        # Log
        log_card = self._make_card("لاگ")
        log_layout = QVBoxLayout(log_card)
        self._log_edit = QTextEdit()
        self._log_edit.setReadOnly(True)
        self._log_edit.setMaximumHeight(120)
        log_layout.addWidget(self._log_edit)
        splitter.addWidget(log_card)

        # History
        hist_card = self._make_card("تاریخچه دانلودها")
        hist_layout = QVBoxLayout(hist_card)
        self._history_list = QListWidget()
        self._history_list.itemDoubleClicked.connect(self._on_history_click)
        hist_layout.addWidget(self._history_list)
        splitter.addWidget(hist_card)

        layout.addWidget(splitter)
        layout.setStretchFactor(splitter, 1)

    def _make_card(self, title):
        card = QWidget()
        card.setObjectName("card")
        card.setStyleSheet("""
            QWidget#card { background-color: #14141e; border: 1px solid #1e2a45; border-radius: 12px; padding: 12px; }
        """)
        layout = QVBoxLayout(card)
        layout.setContentsMargins(12, 8, 12, 12)
        tl = QLabel(title)
        tl.setStyleSheet("color: #a0b4d0; font-size: 13px; font-weight: bold; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #1e2a45;")
        layout.addWidget(tl)
        return card

    # ─── Styles ────────────────────────────────────────────────────────────
    def _apply_stylesheet(self):
        ss = ""
        sp = Path(__file__).parent / "style.qss"
        if sp.exists():
            ss = sp.read_text(encoding="utf-8")
        self.setStyleSheet(ss)

    # ─── Signals ───────────────────────────────────────────────────────────
    def _connect_signals(self):
        self._tunnel.log_signal.connect(self._append_log)
        self._tunnel.status_changed.connect(self._update_status)
        self._worker.error.connect(self._show_error)
        self._worker.progress_update.connect(self._on_progress)
        self._worker.finished.connect(self._on_finished)
        self._worker.status_msg.connect(self._append_log)

    # ─── Status / Tunnel ───────────────────────────────────────────────────
    def _check_tunnel(self):
        self._tunnel.ensure_tunnel()

    def _update_status(self, code):
        labels = {
            0: "● اتصال قطع",
            1: "● در حال بررسی...",
            2: "● اتصال مستقیم",
            3: "● تونل فعال ✓",
            4: "● خطای اتصال",
        }
        colors = {
            0: "#7f1d1d",
            1: "#854d0e",
            2: "#14532d",
            3: "#1e3a5f",
            4: "#7f1d1d",
        }
        self._status_lbl.setText(labels.get(code, "● نامشخص"))
        self._status_lbl.setStyleSheet(f"""
            background-color: {colors.get(code, '#1e2a45')};
            border: 1px solid {colors.get(code, '#2a3a5c')};
            color: #e0e0e8; border-radius: 12px; padding: 4px 12px;
        """)

    # ─── Fetch Info ────────────────────────────────────────────────────────
    def _on_fetch_info(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("لطفاً آدرس معتبر وارد کنید.")
            return
        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(False)
        self._video_formats_lbl.setText("در حال دریافت اطلاعات...")
        self._audio_formats_lbl.setText("در حال دریافت اطلاعات...")
        self._log_edit.append(f"دریافت اطلاعات: {url}")
        self._info_thread = threading.Thread(target=self._fetch_info_bg, args=(url,), daemon=True)
        self._info_thread.start()

    def _fetch_info_bg(self, url):
        info = self._worker.fetch_info(url)
        if info:
            self._current_info = info
            self._video_formats = info.get("formats", [])
            self._audio_formats = [f for f in self._video_formats if f.get("acodec") != "none" and f.get("vcodec") == "none"]
            self._display_formats()
            self._worker.info_fetched.emit(info)
            self._btn_download.setEnabled(True)

    def _display_formats(self):
        # Video: muxed, sorted by height desc
        vids = [f for f in self._video_formats
                if f.get("acodec") != "none" and f.get("vcodec") != "none"
                and f.get("height") is not None]
        vids.sort(key=lambda x: x["height"] or 0, reverse=True)
        self._video_formats_lbl.setText(
            "ویدیو + صدا:\n" +
            "\n".join(f"  {f.get('format_id')} | {f.get('ext','?')} | {f.get('height','?')}p | {fmt_size(f.get('filesize',0))}"
                     for f in vids[:12])
        )
        # Audio: sorted by bitrate desc
        auds = sorted(self._audio_formats,
                      key=lambda x: int(x.get("abr") or x.get("acodec", "")), reverse=True)[:4]
        self._audio_formats_lbl.setText(
            "صدا فقط:\n" +
            "\n".join(f"  {f.get('format_id')} | {f.get('ext','?')} | {f.get('abr','?')}kbps | {fmt_size(f.get('filesize',0))}"
                     for f in auds)
        )

    def _switch_tab(self, tab):
        self._video_grp.setVisible(tab == "video")
        self._audio_grp.setVisible(tab == "audio")
        if tab == "video":
            self._tab_btn_video.setStyleSheet("background:#3b82f6; color:white; border-radius:6px; padding:6px 14px;")
            self._tab_btn_audio.setStyleSheet("")
        else:
            self._tab_btn_audio.setStyleSheet("background:#3b82f6; color:white; border-radius:6px; padding:6px 14px;")
            self._tab_btn_video.setStyleSheet("")

    # ─── Download ──────────────────────────────────────────────────────────
    def _on_download(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("آدرس ویدیو لازم است.")
            return
        # Build format string
        if self._video_grp.isVisible():
            fmt = "+"
        else:
            fmt = "bestaudio[ext=m4a]/bestaudio/best"
        sub_lang = self._sub_combo.currentText()
        sub_lang = "" if sub_lang == "بدون" else sub_lang
        thumb = self._thumb_chk.isChecked()
        out_dir = self._setting_save_dir

        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(True)
        self._progress_bar.setValue(0)
        self._progress_lbl.setText("شروع دانلود...")
        self._log_edit.append(f"شروع دانلود: {url}")

        self._dl_thread = threading.Thread(
            target=self._worker.download,
            args=(url, fmt, out_dir, sub_lang, thumb),
            daemon=True,
        )
        self._dl_thread.start()

    def _cancel_download(self):
        self._log_edit.append("لغو دانلود...")
        self._btn_download.setEnabled(True)
        self._btn_cancel.setEnabled(False)

    def _on_progress(self, pct, speed, downloaded):
        self._progress_bar.setValue(int(pct))
        self._progress_lbl.setText(
            f"{int(pct)}% | {speed} | {fmt_size(downloaded)}"
        )

    def _on_finished(self, ok, info):
        self._btn_download.setEnabled(True)
        self._btn_cancel.setEnabled(False)
        if ok:
            self._progress_bar.setValue(100)
            self._progress_lbl.setText("دانلود تکمیل شد ✓")
            self._save_to_history(info)
            self._populate_history()
        else:
            self._progress_lbl.setText("لغو شد.")

    # ─── History ───────────────────────────────────────────────────────────
    def _save_to_history(self, info):
        entry = {
            "url": info.get("webpage_url", "") or info.get("url", ""),
            "title": info.get("title", "Untitled"),
            "duration": info.get("duration", 0),
            "uploader": info.get("uploader", ""),
            "timestamp": time.time(),
        }
        self._history.insert(0, entry)
        self._history = self._history[:50]
        save_history(self._history)

    def _populate_history(self):
        self._history_list.clear()
        for e in self._history:
            item = QListWidgetItem(f"▶ {e.get('title','?')}")
            item.setData(Qt.ItemDataRole.UserRole, e.get("url",""))
            self._history_list.addItem(item)

    def _on_history_click(self, item):
        url = item.data(Qt.ItemDataRole.UserRole)
        if url:
            self._url_edit.setText(url)
            self._on_fetch_info()

    # ─── Misc ──────────────────────────────────────────────────────────────
    def _change_dir(self):
        d = QFileDialog.getExistingDirectory(self, "انتخاب پوشه دانلود")
        if d:
            self._setting_save_dir = Path(d)
            # Update the label
            for w in self.findChildren(QLabel):
                if str(self._setting_save_dir) in w.text():
                    w.setText(str(self._setting_save_dir))
                    break

    def _append_log(self, msg):
        self._log_edit.append(f"[{time.strftime('%H:%M:%S')}] {msg}")

    def _show_error(self, msg):
        self._log_edit.append(f"خطا: {msg}")
        QMessageBox.warning(self, "خطا", msg)

    # ─── Key Events ────────────────────────────────────────────────────────
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self._cancel_download()
        elif event.key() in (Qt.Key_Return, Qt.Key_Enter):
            if self._btn_download.isEnabled():
                self._on_download()
            else:
                self._on_fetch_info()
        super().keyPressEvent(event)


def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setApplicationName(APP_NAME)

    # Font
    try:
        font = QFont(FONT_NAME)
        if font.exactMatch():
            app.setFont(font)
    except Exception:
        pass

    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
