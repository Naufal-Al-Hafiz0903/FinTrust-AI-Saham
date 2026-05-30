# FinTrust AI Saham - Revisi Jarvis

Dashboard analisis saham dengan data harga realtime/near-realtime dari Yahoo Finance dan prediksi 1-5 hari trading ke depan.

## Fitur utama

- Input ticker tidak dibatasi contoh. Sistem mencoba membaca ticker apa pun yang tersedia di Yahoo Finance.
- Saham Indonesia bisa memakai kode biasa seperti `BBRI`, `BBCA`, `TLKM` atau format Yahoo seperti `BBRI.JK`.
- Saham global bisa memakai `NVDA`, `AAPL`, `MSFT`, dan sejenisnya saat market dipilih Global.
- Crypto bisa memakai `BTC`, `ETH`, atau format `BTC-USD`.
- Harga, situasi market, dan prediksi diambil saat request dilakukan.
- Model ONNX bawaan tetap dipakai untuk XGBoost dan Random Forest.
- Hybrid Ensemble menggabungkan Prophet/fallback trend + XGBoost + Random Forest.

> Catatan penting: data Yahoo Finance dapat delay sesuai aturan bursa. Realtime di sini berarti aplikasi mengambil data terbaru saat request, bukan memakai data statis.

## Cara menjalankan di Windows

Cara paling aman:

1. Extract zip.
2. Buka folder project.
3. Jalankan:

```bat
setup_windows.bat
```

4. Setelah selesai, jalankan:

```bat
start_windows.bat
```

5. Buka browser:

```txt
http://localhost:3000
```

## Kalau menjalankan manual lewat PowerShell

```powershell
cd C:\PA\FinTrust-AI-Saham
npm install
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PYTHON = "$PWD\.venv\Scripts\python.exe"
npm start
```

Opsional untuk Prophet:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-optional.txt
```

Jika Prophet tidak diinstall, aplikasi tetap jalan memakai fallback trend + ONNX.

## Test cepat

```bat
test_prediction_windows.bat
```

Atau buka:

```txt
http://localhost:3000/api/diagnostics
```

Jika diagnostics menampilkan `missing`, jalankan ulang `setup_windows.bat`.

## Penyebab error yang diperbaiki

Error seperti ini:

```txt
ModuleNotFoundError: No module named 'numpy'
ModuleNotFoundError: No module named 'onnxruntime'
```

berarti dependency Python belum terinstall pada Python yang dipakai Node.js. Revisi ini otomatis memakai `.venv` jika ada dan menyediakan `setup_windows.bat`.

Error seperti ini:

```txt
Cannot read properties of undefined (reading 'regularMarketPrice')
```

berarti Yahoo Finance tidak mengembalikan quote untuk simbol tertentu. Revisi ini sudah dibuat lebih aman: server mencoba kandidat simbol dan mengembalikan error JSON yang jelas tanpa crash.
