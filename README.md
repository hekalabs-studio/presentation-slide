# Presentasi Interaktif — Laptop + HP Audiens

Presenter pakai laptop (tampil di layar/proyektor), audiens pakai HP sebagai
kontroler: angkat tangan, tanya (maks 3), reaksi cepat, polling per-slide,
dan kasih rating/feedback di akhir.

## 1. Sekali install (di laptop kamu)

Butuh **Node.js** (download di https://nodejs.org, pilih versi LTS). Setelah
terinstall, buka Terminal/Command Prompt di folder ini lalu jalankan:

```
npm install
```

## 2. Edit materi presentasimu

**Cuma edit file `content.json`.** Jangan ubah file lain. Strukturnya:

```json
{
  "judulPresentasi": "Judul Presentasimu",
  "namaKelompok": "Kelompok 3 - Ani, Budi, Citra",
  "slides": [
    {
      "title": "Judul slide",
      "bullets": ["Poin 1", "Poin 2", "Poin 3"],
      "notes": "Catatan buat kamu sendiri, tidak tampil ke siapa pun",
      "poll": null
    }
  ]
}
```

- Tambah slide baru: copy-paste satu blok `{ "title": ..., "bullets": [...] }`
  di dalam array `slides`.
- Mau ada polling di suatu slide? Isi `"poll"` seperti contoh slide 3:
  ```json
  "poll": {
    "question": "Pertanyaanmu?",
    "options": ["Opsi A", "Opsi B", "Opsi C"]
  }
  ```
  Kalau slide tidak ada polling, tulis `"poll": null`.
- Tips: cek dulu di https://jsonlint.com kalau ragu formatnya valid, biar
  tidak salah taruh koma.
- **Kamu edit `content.json` sambil server jalan?** Tidak perlu restart —
  buka `http://localhost:3000/api/reload` di browser sekali untuk
  memuat ulang materi terbaru.

## 3. Jalankan servernya (pas hari-H)

```
npm start
```

Terminal akan nunjukin sesuatu seperti ini:

```
Presenter (laptop) : http://localhost:3000/presenter.html
Daftar pertanyaan  : http://localhost:3000/questions.html
Kontroler (HP)     : http://<IP-laptop-kamu>:3000/audience.html
```

- **Di laptop kamu**: buka `http://localhost:3000/presenter.html` — ini yang
  disambungkan ke proyektor.
- **Tab kedua di laptop (opsional)**: buka
  `http://localhost:3000/questions.html` untuk lihat semua pertanyaan masuk
  dan kasih rating di akhir — biar tidak numpuk di layar presenter.
- **HP teman-teman**: harus konek ke **WiFi yang sama** dengan laptop kamu.
  Cari tahu IP laptop kamu:
  - Windows: buka CMD, ketik `ipconfig`, cari "IPv4 Address" (contoh: `192.168.1.5`)
  - Mac: System Settings → Wi-Fi → Details, atau ketik `ifconfig | grep inet` di Terminal
  - Lalu suruh teman-teman buka `http://192.168.1.5:3000/audience.html`
    (ganti dengan IP laptop kamu) di browser HP masing-masing.
  - Biar gampang, bikin QR code dari link itu (pakai qr-code-generator.com)
    dan tampilkan di slide pertama biar tinggal scan.

> Kalau kampus/sekolah pakai WiFi dengan "client isolation" (device tidak
> bisa saling lihat), HP tidak akan bisa connect ke laptop meski satu WiFi.
> Solusi paling aman: bikin **hotspot dari HP kamu sendiri**, laptop connect
> ke situ, teman-teman juga connect ke hotspot yang sama.

## 4. Alur pas presentasi

- Ganti slide: klik tombol di bawah layar presenter, atau pakai tombol
  panah kiri/kanan / spasi di keyboard.
- Kalau slide ada pollingnya, tombol "Mulai Polling" akan muncul otomatis.
- Tangan yang diangkat & jumlah pertanyaan/reaksi muncul di pojok kanan
  layar presenter secara real-time.
- Klik "Akhiri & minta feedback" di akhir sesi supaya layar HP teman-teman
  otomatis berubah jadi form rating.

Selamat presentasi! 🎤
# presentation-slide
