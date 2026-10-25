"""
TubeX - Modern YouTube Downloader
PySide6 GUI + yt-dlp + Aether tunnel
Author: Mohammad-Hasan Kaman
"""
import sys, os, json, time, threading
from pathlib import Path
from PySide6.QtWidgets import (
    QFrame,
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QComboBox, QGroupBox,
    QProgressBar, QMessageBox, QFileDialog,
    QTextEdit, QListWidget, QListWidgetItem, QSplitter, QCheckBox,
    QStatusBar,
)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QFont

import yt_dlp

sys.path.insert(0, str(Path(__file__).parent))
from tunnel import (
    TunnelManager, APP_DIR, APP_NAME, DOWNLOADS_DIR, HISTORY_FILE,
    SETTINGS, fmt_size, parse_url, FONT_NAME,
)
from worker import DownloadWorker


def _load_history():
    try:
        if HISTORY_FILE.exists():
            return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def _save_history(h):
    try:
        HISTORY_FILE.write_text(json.dumps(h, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


class CardWidget(QWidget):
    def __init__(self, title, parent=None):
        super().__init__(parent)
        self.setObjectName("card_widget")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(20, 18, 20, 18)
        self._layout.setSpacing(14)

        title_bar = QWidget()
        title_bar.setObjectName("card_title_bar")
        title_h = QHBoxLayout(title_bar)
        title_h.setContentsMargins(0, 0, 0, 0)
        title_lbl = QLabel(title)
        title_lbl.setObjectName("card_title")
        title_h.addWidget(title_lbl)
        title_h.addStretch()
        self._layout.addWidget(title_bar)

        sep = QFrame()
        sep.setObjectName("card_separator")
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setFrameShadow(QFrame.Shadow.Plain)
        sep.setFixedHeight(1)
        self._layout.addWidget(sep)

    def add_widget(self, w):
        self._layout.addWidget(w)

    def add_layout(self, lay):
        self._layout.addLayout(lay)


class StyledButton(QPushButton):
    def __init__(self, text, accent=False, danger=False, parent=None):
        super().__init__(text, parent)
        if accent:
            self.setObjectName("btn_accent")
        elif danger:
            self.setObjectName("btn_danger")
        else:
            self.setObjectName("btn_default")


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TubeX - YouTube Downloader")
        self.setMinimumSize(900, 650)
        self.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        
        self._tunnel = TunnelManager(self)
        self._worker = DownloadWorker(self._tunnel)
        self._history = _load_history()
        self._setting_save_dir = DOWNLOADS_DIR
        self._setup_ui()
        self._connect_signals()
        self._apply_stylesheet()
        self._update_status(0)
        self._populate_history()
        QTimer.singleShot(500, self._check_tunnel)

    def _setup_ui(self):
        central = QWidget()
        central.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Top Bar
        topbar = QWidget()
        topbar.setObjectName("topbar")
        topbar.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        topbar_h = QHBoxLayout(topbar)
        topbar_h.setContentsMargins(24, 14, 24, 14)
        topbar_h.setSpacing(16)

        title_lbl = QLabel("TubeX")
        title_lbl.setObjectName("app_title")
        topbar_h.addWidget(title_lbl)
        topbar_h.addStretch()

        self._status_lbl = QLabel("در حال بررسی اتصال...")
        self._status_lbl.setObjectName("status_badge")
        topbar_h.addWidget(self._status_lbl)

        root.addWidget(topbar)

        # Content Area
        content = QWidget()
        content.setObjectName("content_area")
        content.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(24, 24, 24, 24)
        content_layout.setSpacing(20)

        # URL Input Card
        self._input_card = CardWidget("لینک ویدیو")
        self._url_edit = QLineEdit()
        self._url_edit.setPlaceholderText("آدرس ویدیوی یوتیوب را اینجا وارد کنید")
        self._url_edit.setMinimumHeight(52)
        self._url_edit.setObjectName("url_input")
        self._url_edit.returnPressed.connect(self._fetch_info)
        self._input_card.add_widget(self._url_edit)

        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)
        self._btn_fetch = StyledButton("دریافت اطلاعات", accent=True)
        self._btn_fetch.setMinimumWidth(160)
        self._btn_fetch.clicked.connect(self._fetch_info)
        btn_row.addWidget(self._btn_fetch)

        self._btn_dir = StyledButton("تغییر پوشه")
        self._btn_dir.setMinimumWidth(130)
        self._btn_dir.clicked.connect(self._change_dir)
        btn_row.addWidget(self._btn_dir)

        self._dir_label = QLabel(str(self._setting_save_dir))
        self._dir_label.setObjectName("dir_label")
        self._dir_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self._dir_label.setWordWrap(True)
        self._dir_label.setMinimumWidth(300)
        self._dir_label.setAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        btn_row.addWidget(self._dir_label, 1)

        self._input_card.add_layout(btn_row)
        content_layout.addWidget(self._input_card)

        # Format Selection Card
        self._fmt_card = CardWidget("فرمت دانلود")

        # Tabs
        tab_h = QHBoxLayout()
        tab_h.setSpacing(8)
        self._tab_video = StyledButton("ویدیو", accent=True)
        self._tab_audio = StyledButton("صدا")
        self._tab_video.setMinimumWidth(110)
        self._tab_audio.setMinimumWidth(110)
        self._tab_video.setCheckable(True)
        self._tab_audio.setCheckable(True)
        self._tab_video.setChecked(True)
        self._tab_video.clicked.connect(lambda: self._switch_tab("video"))
        self._tab_audio.clicked.connect(lambda: self._switch_tab("audio"))
        tab_h.addWidget(self._tab_video)
        tab_h.addWidget(self._tab_audio)
        tab_h.addStretch()
        self._fmt_card.add_layout(tab_h)

        # Video formats group
        self._video_grp = QGroupBox("انتخاب کیفیت ویدیو")
        self._video_grp.setObjectName("format_group")
        self._video_v = QVBoxLayout(self._video_grp)
        self._video_v.setSpacing(8)
        self._video_v.setContentsMargins(12, 16, 12, 12)
        
        self._quality_combo = QComboBox()
        self._quality_combo.setObjectName("quality_combo")
        self._quality_combo.addItem("ابتدا دریافت اطلاعات را بزنید")
        self._quality_combo.setEnabled(False)
        self._video_v.addWidget(self._quality_combo)
        self._fmt_card.add_widget(self._video_grp)

        # Audio formats group
        self._audio_grp = QGroupBox("انتخاب کیفیت صدا")
        self._audio_grp.setObjectName("format_group")
        self._audio_v = QVBoxLayout(self._audio_grp)
        self._audio_v.setSpacing(8)
        self._audio_v.setContentsMargins(12, 16, 12, 12)
        
        self._audio_combo = QComboBox()
        self._audio_combo.setObjectName("quality_combo")
        self._audio_combo.addItem("ابتدا دریافت اطلاعات را بزنید")
        self._audio_combo.setEnabled(False)
        self._audio_v.addWidget(self._audio_combo)
        self._audio_grp.setVisible(False)
        self._fmt_card.add_widget(self._audio_grp)

        # Options row
        opts_h = QHBoxLayout()
        opts_h.setSpacing(20)
        lbl_sub = QLabel("زیرنویس:")
        lbl_sub.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        opts_h.addWidget(lbl_sub)
        self._sub_combo = QComboBox()
        self._sub_combo.addItems(["بدون", "fa", "en", "zh-Hans", "ar"])
        self._sub_combo.setMinimumWidth(140)
        self._sub_combo.setObjectName("sub_combo")
        opts_h.addWidget(self._sub_combo)
        opts_h.addStretch()
        
        self._thumb_chk = QCheckBox("دانلود تصویر ویدیو (Thumbnail)")
        self._thumb_chk.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        opts_h.addWidget(self._thumb_chk)
        self._fmt_card.add_layout(opts_h)

        content_layout.addWidget(self._fmt_card)

        # Action Buttons
        act_h = QHBoxLayout()
        act_h.setSpacing(16)
        act_h.addStretch()
        self._btn_cancel = StyledButton("لغو", danger=True)
        self._btn_cancel.setMinimumWidth(130)
        self._btn_cancel.setMinimumHeight(48)
        self._btn_cancel.setEnabled(False)
        self._btn_cancel.clicked.connect(self._cancel_download)
        act_h.addWidget(self._btn_cancel)
        
        self._btn_download = StyledButton("شروع دانلود", accent=True)
        self._btn_download.setMinimumWidth(180)
        self._btn_download.setMinimumHeight(48)
        self._btn_download.setEnabled(False)
        self._btn_download.clicked.connect(self._on_download)
        act_h.addWidget(self._btn_download)
        content_layout.addLayout(act_h)

        # Progress Card
        self._prog_card = CardWidget("وضعیت دانلود")
        self._progress_lbl = QLabel("")
        self._progress_lbl.setObjectName("progress_text")
        self._progress_lbl.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self._progress_bar = QProgressBar()
        self._progress_bar.setValue(0)
        self._progress_bar.setObjectName("main_progress")
        self._progress_bar.setMinimumHeight(16)
        self._prog_card.add_widget(self._progress_lbl)
        self._prog_card.add_widget(self._progress_bar)
        content_layout.addWidget(self._prog_card)

        # Log + History Splitter
        splitter = QSplitter(Qt.Orientation.Vertical)
        splitter.setHandleWidth(6)
        splitter.setChildrenCollapsible(False)

        self._log_card = CardWidget("فعالیت‌ها")
        self._log_edit = QTextEdit()
        self._log_edit.setReadOnly(True)
        self._log_edit.setMaximumHeight(120)
        self._log_edit.setObjectName("log_area")
        self._log_card.add_widget(self._log_edit)
        splitter.addWidget(self._log_card)

        self._hist_card = CardWidget("تاریخچه دانلودها")
        self._history_list = QListWidget()
        self._history_list.itemDoubleClicked.connect(self._on_history_click)
        self._history_list.setObjectName("history_list")
        self._hist_card.add_widget(self._history_list)
        splitter.addWidget(self._hist_card)

        splitter.setSizes([120, 220])
        content_layout.addWidget(splitter)
        content_layout.setStretchFactor(splitter, 1)

        root.addWidget(content)

        # Status bar
        self.statusBar().showMessage("آماده")
        self.statusBar().setObjectName("statusbar")

    def _apply_stylesheet(self):
        ss = ""
        sp = Path(__file__).parent / "style.qss"
        if sp.exists():
            ss = sp.read_text(encoding="utf-8")
        self.setStyleSheet(ss)

    def _connect_signals(self):
        self._tunnel.log_signal.connect(self._append_log)
        self._tunnel.status_changed.connect(self._update_status)
        self._worker.error.connect(self._show_error)
        self._worker.progress_update.connect(self._on_progress)
        self._worker.finished.connect(self._on_finished)
        self._worker.status_msg.connect(self._append_log)

    def _check_tunnel(self):
        self._tunnel.ensure_tunnel()

    def _update_status(self, code):
        labels = {
            0: "قطع اتصال",
            1: "بررسی اتصال...",
            2: "اتصال مستقیم",
            3: "تونل فعال",
            4: "خطای اتصال",
        }
        colors = {
            0: "#7f1d1d",
            1: "#854d0e",
            2: "#14532d",
            3: "#1e3a5f",
            4: "#7f1d1d",
        }
        self._status_lbl.setText(labels.get(code, "نامشخص"))
        self._status_lbl.setStyleSheet(
            "background-color: %s; border: 1px solid %s; color: #e2e8f0; "
            "border-radius: 20px; padding: 5px 16px; font-size: 11px;"
            % (colors.get(code, "#1e293b"), colors.get(code, "#334155"))
        )

    def _fetch_info(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("لطفاً آدرس معتبر وارد کنید.")
            return
        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(False)
        self._quality_combo.clear()
        self._quality_combo.addItem("در حال دریافت اطلاعات...")
        self._quality_combo.setEnabled(False)
        self._audio_combo.clear()
        self._audio_combo.addItem("در حال دریافت اطلاعات...")
        self._audio_combo.setEnabled(False)
        self._log_edit.append(f"دریافت اطلاعات: {url}")
        self._info_thread = threading.Thread(target=self._fetch_info_bg, args=(url,), daemon=True)
        self._info_thread.start()

    def _fetch_info_bg(self, url):
        opts = {"quiet": True, "skip_download": True, "extract_flat": False}
        proxy = self._tunnel.proxy_url
        if proxy:
            opts["proxy"] = proxy
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            if info:
                self._current_info = info
                self._video_formats = [
                    f for f in info.get("formats", [])
                    if f.get("acodec") != "none" and f.get("vcodec") != "none"
                    and f.get("height") is not None
                ]
                self._audio_formats = [
                    f for f in info.get("formats", [])
                    if f.get("acodec") != "none" and f.get("vcodec") == "none"
                ]
                self._display_formats()
                self._btn_download.setEnabled(True)
                self._log_edit.append(f"اطلاعات دریافت شد: {info.get('title', '?')}")
        except Exception as e:
            self._show_error(f"خطا در دریافت اطلاعات: {e}")

    def _display_formats(self):
        vids = sorted(
            [f for f in self._video_formats
             if f.get("acodec") != "none" and f.get("vcodec") != "none"
             and f.get("height") is not None],
            key=lambda x: x.get("height") or 0, reverse=True
        )[:12]
        self._quality_combo.clear()
        for f in vids:
            text = "{} | {} | {}p | {}".format(
                f.get("format_id", "?"), f.get("ext", "?"),
                f.get("height", "?"), fmt_size(f.get("filesize", 0)))
            self._quality_combo.addItem(text)
        self._quality_combo.setEnabled(True)
        self._quality_combo.setCurrentIndex(0)

        auds = sorted(
            self._audio_formats,
            key=lambda x: int(x.get("abr") or 0), reverse=True
        )[:4]
        self._audio_combo.clear()
        for f in auds:
            text = "{} | {} | {}kbps | {}".format(
                f.get("format_id", "?"), f.get("ext", "?"),
                f.get("abr", "?"), fmt_size(f.get("filesize", 0)))
            self._audio_combo.addItem(text)
        self._audio_combo.setEnabled(True)
        self._audio_combo.setCurrentIndex(0)

    def _switch_tab(self, tab):
        self._video_grp.setVisible(tab == "video")
        self._audio_grp.setVisible(tab == "audio")
        if tab == "video":
            self._tab_video.setChecked(True)
            self._tab_audio.setChecked(False)
            self._tab_video.setObjectName("tab_active")
            self._tab_audio.setObjectName("")
        else:
            self._tab_audio.setChecked(True)
            self._tab_video.setChecked(False)
            self._tab_audio.setObjectName("tab_active")
            self._tab_video.setObjectName("")
        self._tab_video.style().unpolish(self._tab_video)
        self._tab_video.style().polish(self._tab_video)
        self._tab_audio.style().unpolish(self._tab_audio)
        self._tab_audio.style().polish(self._tab_audio)

    def _on_download(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("آدرس ویدیو لازم است.")
            return
        fmt = "+" if self._video_grp.isVisible() else "bestaudio[ext=m4a]/bestaudio/best"
        sub_lang = "" if self._sub_combo.currentText() == "بدون" else self._sub_combo.currentText()
        thumb = self._thumb_chk.isChecked()
        out_dir = self._setting_save_dir

        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(True)
        self._progress_bar.setValue(0)
        self._progress_lbl.setText("شروع دانلود...")
        self._log_edit.append("شروع دانلود: " + url)

        self._dl_thread = threading.Thread(
            target=self._download_bg,
            args=(url, fmt, out_dir, sub_lang, thumb),
            daemon=True,
        )
        self._dl_thread.start()

    def _download_bg(self, url, fmt, out_dir, sub_lang, thumb):
        opts = {
            "outtmpl": str(out_dir / "%(title)s.%(ext)s"),
            "format": fmt,
            "quiet": False, "no_warnings": False,
            "merge_output_format": "mp4",
            "progress_with_title": True, "noplaylist": False,
            "writethumbnail": thumb, "simulate": False,
            "extract_flat": False,
        }
        ffmpeg = self._tunnel.get_ffmpeg_binary()
        if ffmpeg:
            opts["ffmpeg_location"] = str(ffmpeg.parent)
        if sub_lang:
            opts["writesubtitles"] = True
            opts["subtitleslangs"] = [sub_lang]
            opts["subtitlesformat"] = "srt/best"
        proxy = self._tunnel.proxy_url
        if proxy:
            opts["proxy"] = proxy
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
            self.progress_update.emit(pct, "%.1f KB/s" % speed, downloaded)
        elif d["status"] == "finished":
            self.status_msg.emit("دانلود تکمیل شد")

    def _cancel_download(self):
        self._log_edit.append("لغو دانلود...")
        self._btn_download.setEnabled(True)
        self._btn_cancel.setEnabled(False)

    def _on_progress(self, pct, speed, downloaded):
        self._progress_bar.setValue(int(pct))
        self._progress_lbl.setText("%d%% | %s | %s" % (int(pct), speed, fmt_size(downloaded)))

    def _on_finished(self, ok, info):
        self._btn_download.setEnabled(True)
        self._btn_cancel.setEnabled(False)
        if ok:
            self._progress_bar.setValue(100)
            self._progress_lbl.setText("دانلود تکمیل شد")
            self._save_to_history(info)
            self._populate_history()
        else:
            self._progress_lbl.setText("لغو شد.")

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
        _save_history(self._history)

    def _populate_history(self):
        self._history_list.clear()
        for e in self._history:
            item = QListWidgetItem(e.get("title", "?"))
            item.setData(Qt.ItemDataRole.UserRole, e.get("url", ""))
            self._history_list.addItem(item)

    def _on_history_click(self, item):
        url = item.data(Qt.ItemDataRole.UserRole)
        if url:
            self._url_edit.setText(url)
            self._fetch_info()

    def _change_dir(self):
        d = QFileDialog.getExistingDirectory(self, "انتخاب پوشه دانلود")
        if d:
            self._setting_save_dir = Path(d)
            self._dir_label.setText(str(self._setting_save_dir))

    def _append_log(self, msg):
        self._log_edit.append("[%s] %s" % (time.strftime("%H:%M:%S"), msg))
        self.statusBar().showMessage(msg[:60])

    def _show_error(self, msg):
        self._log_edit.append("خطا: " + msg)
        QMessageBox.warning(self, "خطا", msg)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self._cancel_download()
        elif event.key() in (Qt.Key_Return, Qt.Key_Enter):
            if self._btn_download.isEnabled():
                self._on_download()
            else:
                self._fetch_info()
        super().keyPressEvent(event)


def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setApplicationName(APP_NAME)
    app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
    
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
