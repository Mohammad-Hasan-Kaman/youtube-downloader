@echo off
chcp 65001 >nul
echo ════════════════════════════════════════
echo  TubeX — Building Windows executable
echo ════════════════════════════════════════
echo.

python --version
echo.

echo [1/3] Installing dependencies...
python -m pip install -q PySide6 PyInstaller yt-dlp qdarkstyle
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [2/3] Building with PyInstaller...
pyinstaller --noconfirm ^
    --onefile ^
    --windowed ^
    --name "TubeX" ^
    --add-data "style.qss;." ^
    --hidden-import "PySide6" ^
    --collect-all PySide6 ^
    main.py

if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo [3/3] Done!
echo.
echo Output: dist\TubeX.exe
echo.
pause
