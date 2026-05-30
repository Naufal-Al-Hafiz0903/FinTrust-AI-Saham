@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] .venv belum ada. Jalankan setup_windows.bat dulu.
  pause
  exit /b 1
)
echo Test Python dependencies...
.venv\Scripts\python.exe -c "import numpy,pandas,yfinance,onnxruntime; print('Python dependencies OK')"
if errorlevel 1 (
  echo [ERROR] Dependency Python belum lengkap. Jalankan setup_windows.bat ulang.
  pause
  exit /b 1
)
echo.
echo Test prediksi BBRI.JK Prophet/fallback...
.venv\Scripts\python.exe predict.py BBRI.JK 5
echo.
echo Test prediksi Random Forest BBRI.JK...
.venv\Scripts\python.exe predict_rf.py BBRI.JK
echo.
pause
