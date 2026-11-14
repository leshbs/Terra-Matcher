## Overview Proyek

**Terra Analog Mission Control** adalah platform web interaktif untuk mencari dan membandingkan kandidat lokasi analog di Bumi terhadap kondisi medan pada area referensi di Mars.

Tujuan utamanya bukan menentukan lokasi pendaratan Mars, melainkan membantu pengguna memahami:

- Lokasi Bumi mana yang memiliki karakteristik medan serupa dengan wilayah Mars tertentu.
- Faktor apa yang membuatnya mirip: kemiringan, kekasaran medan, dan relief.
- Faktor apa yang tetap berbeda dan tidak bisa direplikasi Bumi, seperti gravitasi, atmosfer, radiasi, serta kondisi biologis.
- Bagaimana lokasi tersebut berpotensi digunakan untuk uji rover, navigasi, instrumen, atau studi proses geologi.

MVP akan fokus pada **Mars terlebih dahulu**, tetapi fondasi data dan sistemnya disiapkan agar Bulan dapat ditambahkan kemudian.

## Rencana Struktur Sistem

```text
NASA / sumber data terbuka
        ↓
Pipeline AI offline berbasis Python
(cleaning → feature engineering → normalisasi → similarity ranking)
        ↓
Model artifact, ranking, GeoJSON, metadata sumber
        ↓
Supabase PostgreSQL + static data assets
        ↓
Next.js API routes
        ↓
Terra Analog Mission Control di *.vercel.app
```

### Front-end

- Next.js + TypeScript
- Tailwind CSS
- MapLibre GL JS untuk peta 2D interaktif
- Recharts untuk grafik perbandingan dan kontribusi skor
- Vercel untuk deployment MVP

### Back-end dan database

- Next.js Route Handlers sebagai API
- Supabase PostgreSQL untuk:
  - lokasi Mars dan kandidat Bumi;
  - nilai fitur tiap lokasi;
  - dataset provenance;
  - model version;
  - skor ranking;
  - kontribusi skor per fitur;
  - evidence dan keterbatasan ilmiah.
- Static GeoJSON/layer assets untuk menjaga demo tetap cepat dan tidak bergantung pada pemrosesan data real-time.

### AI/data layer

Model MVP adalah **explainable similarity engine**, bukan deep learning.

Prosesnya:

1. Mengumpulkan data topografi Mars dan Bumi.
2. Membuat fitur yang sebanding:
   - median slope;
   - terrain roughness;
   - relative relief.
3. Menormalisasi fitur secara terpisah untuk Bumi dan Mars.
4. Menghitung weighted distance.
5. Mengubah jarak menjadi similarity score 0–100.
6. Menampilkan kontribusi tiap fitur dan data coverage.
7. Menyimpan hasil sebagai model run yang dapat dilacak.

## Fitur yang Akan Dibuat

### 1. Mission Control Landing Page

Halaman utama yang menjelaskan tujuan produk, konteks NASA Space Apps, cara kerja singkat, featured Mars scenario, dan batasan ilmiah sistem.

### 2. Interactive 2D Mars Map

Peta Mars yang mendukung:

- Pan dan zoom.
- Klik area referensi.
- Layer topografi.
- Layer slope.
- Layer terrain roughness.
- Legend, unit, dan sumber data tiap layer.

### 3. Multi-Layer Controls

Panel untuk mengaktifkan atau menonaktifkan layer peta serta melihat arti warna, resolusi, dan sumber data.

### 4. Location Inspection Panel

Saat pengguna memilih area, panel menampilkan:

- Nama dan koordinat.
- Nilai fitur medan.
- Sumber dataset.
- Kualitas/cakupan data.
- Ringkasan relevansi eksplorasi.
- Catatan keterbatasan.

### 5. Earth–Mars Comparison Workspace

Tampilan side-by-side untuk membandingkan Mars reference zone dengan kandidat lokasi Bumi:

- Nilai mentah dan nilai normalisasi.
- Grafik profil medan.
- Fitur yang cocok.
- Fitur yang tidak cocok.
- Kondisi yang belum dimodelkan.
- Evidence dan sitasi.

### 6. Similarity Ranking Dashboard

Daftar kandidat analog Bumi dengan:

- Urutan ranking.
- Similarity score.
- Data coverage.
- Kontribusi masing-masing fitur.
- Penjelasan singkat mengapa kandidat berada pada ranking tersebut.
- Label “candidate hypothesis”, bukan rekomendasi lokasi final.

### 7. Methodology & Provenance Page

Halaman transparansi yang menjelaskan:

- Dataset yang digunakan.
- Rumus similarity score.
- Cara normalisasi data.
- Model version.
- Keterbatasan metode.
- Perbedaan kondisi Bumi dan Mars.

### 8. Moon-Ready Foundation

Belum menjadi fitur MVP utama, tetapi struktur database dan model sudah mendukung `earth`, `mars`, dan `moon`. Setelah Mars stabil, data LOLA dan skenario Bulan dapat ditambahkan tanpa merombak sistem inti.