# TubeX — Build script for Windows (PowerShell)
param([switch]$Verbose)

Write-Host "══════════════════════════════════════"
Write-Host " TubeX — Building Windows executable"
Write-Host "══════════════════════════════════════"
Write-Host ""

# Check Python
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { Write-Host "ERROR: python not found"; exit 1 }
python --version

# Install deps
Write-Host ""
Write-Host "[1/3] Installing dependencies..."
python -m pip install -q PySide6 PyInstaller yt-dlp qdarkstyle
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pip install failed"; exit 1 }

# Build
Write-Host "[2/3] Building with PyInstaller..."
$extra = @()
if ($PSCmdlet.MyInvocation.BoundParameters.ContainsKey('Verbose')) { $extra += "--log-level=DEBUG" }

& pyinstaller --noconfirm @extra `
    --onefile `
    --windowed `
    --name "TubeX" `
    --add-data "style.qss;." `
    --hidden-import "PySide6" `
    --collect-all PySide6 `
    main.py

if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Build failed"; exit 1 }

# Cleanup (optional, comment out if you want to keep the dist folder)
# Remove-Item -Recurse -Force build

Write-Host "[3/3] Done!"
Write-Host ""
Write-Host "Output: dist\TubeX.exe"
Write-Host ""
Write-Host "To run without building:"
Write-Host "  python main.py"
Write-Host ""
