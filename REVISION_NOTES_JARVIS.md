# Catatan Revisi Jarvis

## Perbaikan dari error terbaru

1. Menambahkan `setup_windows.bat` untuk install dependency Node.js dan Python.
2. Menambahkan `start_windows.bat` agar server selalu memakai Python dari `.venv`.
3. Menambahkan `test_prediction_windows.bat` untuk cek dependency dan prediksi cepat.
4. Mengubah `server.js` agar:
   - otomatis memakai `.venv\Scripts\python.exe` jika tersedia,
   - error dependency Python memberi instruksi jelas,
   - quote Yahoo Finance yang kosong tidak membuat server crash,
   - ticker lookup mencoba beberapa kandidat simbol,
   - default market API menjadi lebih aman dengan mode auto.
5. Memisahkan Prophet ke `requirements-optional.txt` karena install Prophet lebih berat di Windows.
6. `requirements.txt` sekarang berisi dependency wajib agar XGBoost/RF/Hybrid bisa berjalan.

## Batasan jujur

- Tidak ada sistem yang bisa menjamin semua kode saham di dunia tersedia. Aplikasi bisa memprediksi semua ticker yang memiliki data OHLCV cukup di Yahoo Finance.
- Harga disebut realtime/near-realtime karena diambil saat request, tetapi Yahoo Finance bisa delay sesuai aturan exchange.
- Model ONNX bawaan bukan ditraining ulang dari nol; revisi ini memperbaiki pipeline realtime, validasi ticker, fitur, output, dan hybrid scoring.
