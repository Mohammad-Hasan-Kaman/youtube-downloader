@echo off
chcp 65001 >nul
REM KamanTube - Windows build script
REM 1) fetch runtime binaries  2) install deps  3) build installer + portable exe
cd /d "%~dp0"
if not exist "vendor\aether\aether.exe" call node scripts/fetch-binaries.js
call npm install
call npm run dist
echo.
echo Build finished. Output in dist_out\
pause
