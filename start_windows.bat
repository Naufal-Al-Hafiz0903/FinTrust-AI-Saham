@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] .venv belum ada. Jalankan setup_windows.bat dulu.
  pause
  exit /b 1
)
set "PYTHON=%CD%\.venv\Scripts\python.exe"
echo Menggunakan Python: %PYTHON%
echo Membuka server FinTrust AI Saham...
call npm start
