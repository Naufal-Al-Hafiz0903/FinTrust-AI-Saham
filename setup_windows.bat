@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo  FinTrust AI Saham - Setup Windows
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js belum terinstall atau belum masuk PATH.
  echo Install Node.js LTS dulu, lalu jalankan file ini lagi.
  pause
  exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Python belum terinstall atau belum masuk PATH.
    echo Install Python 3.10/3.11/3.12, centang Add Python to PATH, lalu jalankan file ini lagi.
    pause
    exit /b 1
  )
  set PY_CMD=python
) else (
  set PY_CMD=py -3
)

echo [1/4] Install dependency Node.js...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install gagal.
  pause
  exit /b 1
)

echo.
echo [2/4] Membuat virtual environment Python .venv...
%PY_CMD% -m venv .venv
if errorlevel 1 (
  echo [ERROR] Gagal membuat .venv.
  pause
  exit /b 1
)

echo.
echo [3/4] Upgrade pip...
call .venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
if errorlevel 1 (
  echo [ERROR] Upgrade pip gagal.
  pause
  exit /b 1
)

echo.
echo [4/4] Install dependency Python wajib...
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Install requirements.txt gagal.
  echo Coba jalankan ulang file ini sebagai Administrator atau cek koneksi internet.
  pause
  exit /b 1
)

echo.
echo [OPSIONAL] Prophet bisa membuat prediksi harga lebih kuat, tapi install-nya lebih berat.
choice /C YN /N /M "Install Prophet juga? (Y/N): "
if errorlevel 2 goto SKIP_PROPHET
call .venv\Scripts\python.exe -m pip install -r requirements-optional.txt
if errorlevel 1 (
  echo [WARNING] Prophet gagal diinstall. Aplikasi tetap bisa jalan memakai fallback trend + ONNX.
)
:SKIP_PROPHET

echo.
echo Setup selesai.
echo Jalankan aplikasi dengan: start_windows.bat
echo.
pause
