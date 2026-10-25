"""
TubeX - Modern YouTube Downloader
PySide6 GUI + yt-dlp + Aether tunnel
Author: Mohammad-Hasan Kaman
"""
import sys, os, json, time, threading
from pathlib import Path
from PySide6.QtWidgets import (
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
    """A card container with a title bar."""
    def __init__(self, title, parent=None):
        super().__init__(parent)
        self.setObjectName("card_widget")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(16, 14, 16, 16)
        self._layout.setSpacing(12)
        title_bar = QWidget()
        title_bar.setObjectName("card_title_bar")
        title_h = QHBoxLayout(title_bar)
        title_h.setContentsMargins(0, 0, 0, 0)
        title_lbl = QLabel(title)
        title_lbl.setObjectName("card_title")
        title_h.addWidget(title_lbl)
        title_h.addStretch()
        self._layout.addWidget(title_bar)

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
        self.setWindowTitle("TubeX")
        self.setMinimumSize(800, 560)
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
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        topbar = QWidget()
        topbar.setObjectName("topbar")
        topbar_h = QHBoxLayout(topbar)
        topbar_h.setContentsMargins(20, 10, 20, 10)
        topbar_h.setSpacing(16)
        title_lbl = QLabel("TubeX")
        title_lbl.setObjectName("app_title")
        topbar_h.addWidget(title_lbl)
        topbar_h.addStretch()
        self._status_lbl = QLabel("\u062f\u0631 \u0647\u0627\u0644 \u0628\u0631\u0631\u0633\u06cc...")
        self._status_lbl.setObjectName("status_badge")
        topbar_h.addWidget(self._status_lbl)
        root.addWidget(topbar)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(20, 20, 20, 20)
        content_layout.setSpacing(14)

        self._input_card = CardWidget("\u0644\u06cc\u0646\u06a9 \u0648\u06cc\u062f\u06cc\u0648")
        self._url_edit = QLineEdit()
        self._url_edit.setPlaceholderText("\u0627\u0631\u062f\u0633 \u0648\u06cc\u062f\u06cc\u0648\u06cc \u0648\u06cc\u0648\u062a\u06cc\u0628 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f")
        self._url_edit.setMinimumHeight(48)
        self._url_edit.returnPressed.connect(self._fetch_info)
        self._input_card.add_widget(self._url_edit)

        btn_row = QHBoxLayout()
        btn_row.setSpacing(10)
        self._btn_fetch = StyledButton("\u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a", accent=True)
        self._btn_fetch.clicked.connect(self._fetch_info)
        btn_row.addWidget(self._btn_fetch, 1)
        self._btn_dir = StyledButton("\u062a\u063a\u06cc\u06cc\u0631 \u067e\u0648\u0634\u0647")
        self._btn_dir.clicked.connect(self._change_dir)
        btn_row.addWidget(self._btn_dir)
        self._dir_label = QLabel(str(self._setting_save_dir))
        self._dir_label.setObjectName("dir_label")
        self._dir_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        btn_row.addWidget(self._dir_label, 1)
        self._input_card.add_layout(btn_row)
        content_layout.add_widget(self._input_card)

        self._fmt_card = CardWidget("\u0641\u0631\u0645\u062a \u062f\u0627\u0646\u0644\u0648\u062f")
        tab_h = QHBoxLayout()
        tab_h.setSpacing(4)
        self._tab_video = StyledButton("\u0648\u06cc\u062f\u06cc\u0648")
        self._tab_audio = StyledButton("\u0635\u062f\u0627")
        self._tab_video.clicked.connect(lambda: self._switch_tab("video"))
        self._tab_audio.clicked.connect(lambda: self._switch_tab("audio"))
        tab_h.addWidget(self._tab_video)
        tab_h.addWidget(self._tab_audio)
        tab_h.addStretch()
        self._fmt_card.add_layout(tab_h)

        self._video_grp = QGroupBox("\u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u06cc\u0641\u06cc\u062a")
        self._video_v = QVBoxLayout(self._video_grp)
        self._video_v.setSpacing(4)
        self._video_formats_lbl = QLabel("\u0627\u0628\u062a\u062f\u0627 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a \u0631\u0627 \u0628\u0632\u0646\u06cc\u062f.")
        self._video_formats_lbl.setWordWrap(True)
        self._video_formats_lbl.setObjectName("format_info")
        self._video_v.addWidget(self._video_formats_lbl)
        self._fmt_card.add_widget(self._video_grp)

        self._audio_grp = QGroupBox("\u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u06cc\u0641\u06cc\u062a \u0635\u062f\u0627")
        self._audio_v = QVBoxLayout(self._audio_grp)
        self._audio_v.setSpacing(4)
        self._audio_formats_lbl = QLabel("\u0627\u0628\u062a\u062f\u0627 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a \u0631\u0627 \u0628\u0632\u0646\u06cc\u062f.")
        self._audio_formats_lbl.setWordWrap(True)
        self._audio_formats_lbl.setObjectName("format_info")
        self._audio_v.addWidget(self._audio_formats_lbl)
        self._audio_grp.setVisible(False)
        self._fmt_card.add_widget(self._audio_grp)

        opts_h = QHBoxLayout()
        opts_h.setSpacing(16)
        opts_h.addWidget(QLabel("\u0632\u06cc\u0631\u0646\u0648\u06cc\u0633:"))
        self._sub_combo = QComboBox()
        self._sub_combo.addItems(["\u0628\u062f\u0648\u0646", "fa", "en", "zh-Hans", "ar"])
        opts_h.addWidget(self._sub_combo)
        opts_h.addStretch()
        self._thumb_chk = QCheckBox("\u062f\u0627\u0646\u0644\u0648\u062f \u062a\u0635\u0648\u06cc\u0631 \u0648\u06cc\u062f\u06cc\u0648")
        opts_h.addWidget(self._thumb_chk)
        self._fmt_card.add_layout(opts_h)
        content_layout.add_widget(self._fmt_card)

        act_h = QHBoxLayout()
        act_h.setSpacing(12)
        self._btn_download = StyledButton("\u0634\u0631\u0648\u0639 \u062f\u0627\u0646\u0644\u0648\u062f", accent=True)
        self._btn_download.setEnabled(False)
        self._btn_download.clicked.connect(self._on_download)
        act_h.addWidget(self._btn_download)
        self._btn_cancel = StyledButton("\u0644\u063a\u0648", danger=True)
        self._btn_cancel.setEnabled(False)
        self._btn_cancel.clicked.connect(self._cancel_download)
        act_h.addWidget(self._btn_cancel)
        act_h.addStretch()
        content_layout.add_layout(act_h)

        self._prog_card = CardWidget("\u0648\u0636\u0639\u06cc\u062a \u062f\u0627\u0646\u0644\u0648\u062f")
        self._progress_lbl = QLabel("")
        self._progress_lbl.setObjectName("progress_text")
        self._progress_bar = QProgressBar()
        self._progress_bar.setValue(0)
        self._progress_bar.setObjectName("main_progress")
        self._prog_card.add_widget(self._progress_lbl)
        self._prog_card.add_widget(self._progress_bar)
        content_layout.add_widget(self._prog_card)

        splitter = QSplitter(Qt.Vertical)
        splitter.setHandleWidth(4)

        self._log_card = CardWidget("\u0641\u0639\u0627\u0644\u06cc\u062a‌‌ه\u0627")
        self._log_edit = QTextEdit()
        self._log_edit.setReadOnly(True)
        self._log_edit.setMaximumHeight(90)
        self._log_edit.setObjectName("log_area")
        self._log_card.add_widget(self._log_edit)
        splitter.addWidget(self._log_card)

        self._hist_card = CardWidget("\u062a\u0627\u0631\u06cc\u062e\u0686\u0647 \u062f\u0627\u0646\u0644\u0648\u062f\u0647\u0627")
        self._history_list = QListWidget()
        self._history_list.itemDoubleClicked.connect(self._on_history_click)
        self._hist_card.add_widget(self._history_list)
        splitter.addWidget(self._hist_card)

        content_layout.add_widget(splitter)
        content_layout.setStretchFactor(splitter, 1)
        root.addWidget(content)
        self.statusBar().showMessage("\u0622\u0645\u0627\u062f\u0647")
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
            0: "\u0642\u0637\u0639\u06cc \u0627\u062a\u0635\u0627\u0644",
            1: "\u0628\u0631\u0631\u0633\u06cc \u0627\u062a\u0635\u0627\u0644...",
            2: "\u0645\u0633\u062a\u0642\u06cc\u0645",
            3: "\u062a\u0648\u0646\u0644 \u0641\u0639\u0627\u0644",
            4: "\u062e\u0637\u0627 \u0627\u062a\u0635\u0627\u0644",
        }
        colors = {0: "#7f1d1d", 1: "#854d0e", 2: "#14532d", 3: "#1e3a5f", 4: "#7f1d1d"}
        self._status_lbl.setText(labels.get(code, "\u0646\u0627\u0645\u0634\u062e\u0648\u0636"))
        self._status_lbl.setStyleSheet(
            "background-color: %s; border: 1px solid %s; color: #e2e8f0; "
            "border-radius: 20px; padding: 4px 14px; font-size: 11px;"
            % (colors.get(code, "#1e293b"), colors.get(code, "#334155"))
        )

    def _fetch_info(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("\u0644\u0637\u0641\u0627 \u0627\u0631\u062f\u0633 \u0645\u0639\u062a\u0628\u0631 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f.")
            return
        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(False)
        self._video_formats_lbl.setText("\u062f\u0631 \u0647\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a...")
        self._audio_formats_lbl.setText("\u062f\u0631 \u0647\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a...")
        self._log_edit.append("\u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a: " + url)
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
                self._log_edit.append("\u0627\u067e\u0644\u06cc\u06a9\u0627\u062a \u062f\u0631\u06cc\u0627\u0641\u062a \u0634\u062f: " + str(info.get("title", "?")))
        except Exception as e:
            self._show_error("\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u067e\u0644\u06cc\u06a9\u0627\u062a: " + str(e))

    def _display_formats(self):
        vids = sorted(
            [f for f in self._video_formats
             if f.get("acodec") != "none" and f.get("vcodec") != "none"
             and f.get("height") is not None],
            key=lambda x: x.get("height") or 0, reverse=True
        )[:12]
        lines = []
        for f in vids:
            lines.append("  %s | %s | %sp | %s" % (
                f.get("format_id", "?"), f.get("ext", "?"),
                f.get("height", "?"), fmt_size(f.get("filesize", 0))))
        self._video_formats_lbl.setText("\n".join(lines))

        auds = sorted(
            self._audio_formats,
            key=lambda x: int(x.get("abr") or 0), reverse=True
        )[:4]
        lines = []
        for f in auds:
            lines.append("  %s | %s | %skbps | %s" % (
                f.get("format_id", "?"), f.get("ext", "?"),
                f.get("abr", "?"), fmt_size(f.get("filesize", 0))))
        self._audio_formats_lbl.setText("\n".join(lines))

    def _switch_tab(self, tab):
        self._video_grp.setVisible(tab == "video")
        self._audio_grp.setVisible(tab == "audio")
        if tab == "video":
            self._tab_video.setObjectName("tab_active")
            self._tab_audio.setObjectName("")
        else:
            self._tab_audio.setObjectName("tab_active")
            self._tab_video.setObjectName("")

    def _on_download(self):
        url = parse_url(self._url_edit.text())
        if not url:
            self._show_error("\u0627\u0631\u062f\u0633 \u0648\u06cc\u062f\u06cc\u0648 \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.")
            return
        fmt = "+" if self._video_grp.isVisible() else "bestaudio[ext=m4a]/bestaudio/best"
        sub_lang = "" if self._sub_combo.currentText() == "\u0628\u062f\u0648\u0646" else self._sub_combo.currentText()
        thumb = self._thumb_chk.isChecked()
        out_dir = self._setting_save_dir
        self._btn_download.setEnabled(False)
        self._btn_cancel.setEnabled(True)
        self._progress_bar.setValue(0)
        self._progress_lbl.setText("\u0634\u0631\u0648\u0639 \u062f\u0627\u0646\u0644\u0648\u062f...")
        self._log_edit.append("\u0634\u0631\u0648\u0639 \u062f\u0627\u0646\u0644\u0648\u062f: " + url)
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
            self.status_msg.emit("\u062f\u0627\u0646\u0644\u0648\u062f \u062a\u06a9\u0645\u06cc\u0644 \u0634\u062f")

    def _cancel_download(self):
        self._log_edit.append("\u0644\u063a\u0648 \u062f\u0627\u0646\u0644\u0648\u062f...")
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
            self._progress_lbl.setText("\u062f\u0627\u0646\u0644\u0648\u062f \u062a\u06a9\u0645\u06cc\u0644 \u0634\u062f")
            self._save_to_history(info)
            self._populate_history()
        else:
            self._progress_lbl.setText("\u0644\u063a\u0648 \u0634\u062f.")

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
        d = QFileDialog.getExistingDirectory(self, "\u0627\u0646\u062a\u062e\u0627\u0628 \u067e\u0648\u0634\u0647 \u062f\u0627\u0646\u0644\u0648\u062f")
        if d:
            self._setting_save_dir = Path(d)
            self._dir_label.setText(str(self._setting_save_dir))

    def _append_log(self, msg):
        self._log_edit.append("[%s] %s" % (time.strftime("%H:%M:%S"), msg))
        self.statusBar().showMessage(msg[:60])

    def _show_error(self, msg):
        self._log_edit.append("\u062e\u0637\u0627: " + msg)
        QMessageBox.warning(self, "\u062e\u0637\u0627", msg)

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
