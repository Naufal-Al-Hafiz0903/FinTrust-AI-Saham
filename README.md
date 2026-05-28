# FinTrust AI Saham

Dashboard analisis saham berbasis multi-agent AI untuk saham Indonesia dan saham luar negeri.

## Fitur utama

- Analisis saham Indonesia dan saham luar negeri dari Yahoo Finance.
- Tipe saham dipisah jelas: `Saham Indonesia`, `Saham Luar Negeri`, dan `IPO / Watchlist`.
- Jika kode saham diisi, sistem menganalisis saham tersebut.
- Jika dua kode saham atau lebih diisi, sistem membandingkan saham pada tipe saham yang sama.
- Jika kode saham kosong tetapi nominal investasi diisi, sistem melakukan pencarian rekomendasi berdasarkan tipe saham yang dipilih dan harga realtime.
- Jika kode saham dan nominal sama-sama kosong, sistem menampilkan warning merah.
- Jika nominal tidak cukup untuk membeli saham berdasarkan harga realtime, sistem menampilkan notifikasi kuning.
- Rekomendasi pembelian tidak dibiarkan kosong. Jika tidak layak beli, tampil `Tidak Direkomendasikan Beli`.
- Perhitungan saham Indonesia memakai minimal 1 lot atau 100 saham.
- Perhitungan saham luar negeri memakai minimal 1 saham utuh.
- Kurs USD/IDR realtime dari Yahoo Finance dipakai untuk konversi IDR dan USD.
- Grafik skor saham dan diagram alokasi pembelian aktif.
- Backend Node.js + Express.
- AI memakai Groq API.
- Market data memakai yahoo-finance2.

## Menjalankan di localhost

```powershell
npm install
copy .env.example .env
```

Isi `GROQ_API_KEY` di file `.env`.

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

Jalankan aplikasi:

```powershell
npm start
```

Buka browser:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

Cek kurs realtime:

```text
http://localhost:3000/api/fx/usdidr
```

## Cara memakai

1. Pilih `Saham Indonesia` atau `Saham Luar Negeri`.
2. Pilih cakupan pencarian. Default-nya `Semua Sektor`.
3. Untuk analisis satu saham, isi satu kode saham.
4. Untuk perbandingan, isi beberapa kode saham, contoh `ADRO, PTBA, ITMG` atau `NVDA, AMD, AVGO`.
5. Untuk rekomendasi otomatis, kosongkan kode saham dan isi nominal investasi.
6. Klik `Analisa`.

Contoh:

- `BBCA` tanpa nominal: analisis saham saja.
- `BBCA` dengan nominal `1000000`: analisis dan jumlah beli jika nominal cukup.
- Kosongkan kode, pilih `Saham Indonesia`, pilih `Semua Sektor`, nominal `5000000`: sistem mencari saham Indonesia yang mampu dibeli.
- Kosongkan kode, pilih `Saham Luar Negeri`, nominal `1200000` IDR: sistem memakai kurs realtime untuk mengecek apakah nominal cukup membeli saham luar negeri.
- `ADRO, PTBA, ITMG`: perbandingan saham batu bara.
- `NVDA, AMD, AVGO`: perbandingan saham semikonduktor luar negeri.

## Catatan

Jika `GROQ_API_KEY` belum valid, aplikasi tetap menampilkan hasil fallback lokal memakai harga dari Yahoo Finance. Untuk analisis AI penuh, isi API key yang benar lalu restart `npm start`.

Aplikasi ini hanya untuk edukasi dan riset. Bukan saran investasi resmi.
