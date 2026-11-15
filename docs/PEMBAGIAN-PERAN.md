Berikut pembagian paling aman untuk 5 orang dalam 2 hari × 4 jam/orang. Prinsipnya: semua anggota bisa mulai dari data dan kontrak yang dibekukan sejak awal, lalu integrasi hanya memakai file/API contract yang sudah disepakati.

## Aturan kerja agar tidak saling menunggu

- Bekukan scope dalam 20 menit pertama: 1 Mars scenario, 5 kandidat Bumi, 3 fitur utama.
- Gunakan data fixture/JSON terlebih dahulu. Integrasi data nyata dilakukan belakangan.
- Semua output antar anggota harus berupa file/kontrak jelas, bukan penjelasan lisan.
- Hindari fitur baru setelah akhir sesi Hari 1.
- Satu orang menjadi integrator final dan pemegang keputusan scope.

## Anggota 1 — Product Lead, Full-stack Integrator & Backend Owner

Fokus: menjaga scope, memiliki sistem backend, menyatukan seluruh bagian, serta memastikan demo dan rubrik kuat. Backend MVP bersifat **static-first**: model AI diproses offline oleh Anggota 2, lalu Anggota 1 menyajikan hasil final melalui Supabase dan Next.js API. Tidak ada training atau pemrosesan raster saat pengguna membuka web.

### Hari 1

- [ ] Membuat board tugas dan urutan prioritas.
- [ ] Mengunci nama produk, one-liner, Mars scenario utama, dan 5 kandidat Bumi.
- [ ] Mengunci tiga fitur model: slope, terrain roughness, relative relief.
- [ ] Menyusun kontrak data ringkas untuk tim: ID lokasi, nama, koordinat, fitur, skor, sumber, limitations.
- [ ] Membuat skeleton Next.js dan struktur halaman.
- [ ] Membuat project Supabase serta environment variables lokal/Preview/Production.
- [ ] Membuat tabel `datasets`, `model_runs`, `locations`, `location_features`, `rankings`, `ranking_contributions`, dan `location_evidence`.
- [ ] Mengaktifkan read-only access untuk data publik; tidak ada anonymous write, upload pengguna, atau service-role key di browser.
- [ ] Membuat seed data sementara agar frontend dapat bekerja tanpa menunggu hasil AI final.
- [ ] Membuat API dasar: `GET /api/scenarios`, `GET /api/scenarios/[scenarioId]`, `GET /api/scenarios/[scenarioId]/rankings`, `GET /api/candidates/[candidateId]`, dan `GET /api/compare`.
- [ ] Menyepakati format API/JSON dengan anggota data dan frontend.
- [ ] Memastikan semua anggota bekerja di file/modul berbeda.

### Hari 2

- [ ] Mengintegrasikan peta, ranking, comparison, dan source cards.
- [ ] Memvalidasi serta mengimpor paket data final dari Anggota 2 ke Supabase.
- [ ] Memastikan setiap respons ranking membawa `modelRunId`, versi model, sumber data, dan coverage; tidak ada skor tanpa provenance.
- [ ] Menambahkan fallback JSON statis bila Supabase tidak tersedia saat demo.
- [ ] Menangani ID scenario/kandidat yang tidak ditemukan dan bobot fitur tidak valid tanpa membocorkan detail database.
- [ ] Menentukan apa yang dipotong jika ada fitur belum selesai.
- [ ] Melakukan smoke test seluruh alur demo.
- [ ] Deploy ke Vercel.
- [ ] Menjaga satu URL production yang stabil.
- [ ] Menyusun demo path 90 detik.

Output wajib:

- Aplikasi terintegrasi.
- Deployment `.vercel.app`.
- API production dan database read-only yang terhubung ke data final.
- Fallback dataset untuk demo.
- Daftar fitur final.
- Demo script.

### Kontrak sistem backend

```text
Pipeline Python Anggota 2
        ↓ paket data tervalidasi
Supabase PostgreSQL + static GeoJSON/JSON
        ↓
Next.js Route Handlers milik Anggota 1
        ↓
Map frontend Anggota 3 + ranking/comparison Anggota 4
```

Tanggung jawab backend hanya menyajikan data/model yang sudah difinalisasi. Backend **tidak boleh** mengunduh data NASA saat request, menjalankan training, memproses raster, atau menyimpan hasil custom user ke database.

### Kontrak API minimum

Semua endpoint mengembalikan bentuk berikut:

```json
{
  "data": {},
  "meta": {
    "modelRunId": "2026-11-14-mvp-v1",
    "modelVersion": "1.0.0"
  }
}
```

`/api/scenarios/[scenarioId]/rankings` menyediakan `rank`, `score`, `dataCoverage`, kandidat, dan `contributions`. `/api/compare` menyediakan nilai mentah, unit, nilai normalisasi, match/mismatch, evidence, serta limitations. Anggota 3 dan 4 boleh memakai respons fixture dengan bentuk yang sama sejak Hari 1.

## Anggota 2 — Data & AI Engineer

Fokus: membuat hasil ranking yang benar, transparan, dan siap dipakai web.

### Hari 1

- [ ] Menentukan sumber data Mars dan Bumi yang dipakai.
- [ ] Membuat `datasets.json` berisi provider, produk, URL, resolusi, unit, dan citation.
- [ ] Menyiapkan data untuk 1 Mars scenario dan 5 kandidat Bumi.
- [ ] Menghasilkan nilai tiga fitur per lokasi.
- [ ] Memastikan tiap fitur memiliki unit, source ID, dan data quality flag.
- [ ] Membuat `locations.json` dan `location-features.json`.
- [ ] Membuat fixture data jika data akhir belum selesai.

### Hari 2

- [ ] Membuat script similarity score berbobot.
- [ ] Menghasilkan `rankings.json` dan `ranking-contributions.json`.
- [ ] Menambahkan `dataCoverage` pada setiap ranking.
- [ ] Menulis penjelasan otomatis per kandidat: strongest match dan largest mismatch.
- [ ] Menjalankan sanity check: kandidat dengan profil sintetis mirip harus mendapat skor lebih tinggi dari kandidat ekstrem.
- [ ] Mengirim data final ke integrator maksimal pertengahan Hari 2.

Output wajib:

```text
public/data/
├─ datasets.json
├─ locations.json
├─ location-features.json
├─ rankings.json
├─ ranking-contributions.json
└─ candidates.geojson
```

Paket final juga wajib memuat `model_manifest.json` serta `location-evidence.json`. Anggota 2 hanya menulis paket data dan script pipeline; Anggota 1 yang melakukan import database agar frontend tidak menunggu akses atau konfigurasi Supabase.

## Anggota 3 — Map & Explorer Frontend Engineer

Fokus: membuat pengalaman peta interaktif yang terlihat kuat saat demo.

### Hari 1

- [ ] Membuat halaman `/explore`.
- [ ] Memasang MapLibre GL JS.
- [ ] Membuat peta dasar Mars.
- [ ] Menambahkan pan, zoom, reset view, dan click handler.
- [ ] Membuat komponen `LayerControl`.
- [ ] Menyiapkan tiga layer visual: elevation, slope, roughness.
- [ ] Menggunakan mock GeoJSON agar pekerjaan tidak menunggu data engineer.

### Hari 2

- [ ] Mengganti mock GeoJSON dengan `candidates.geojson` final.
- [ ] Membuat legend dan unit untuk setiap layer.
- [ ] Membuat selected-state untuk Mars scenario dan Earth candidate.
- [ ] Membuat responsive bottom sheet untuk mobile.
- [ ] Menambahkan empty/error state jika layer tidak tersedia.
- [ ] Menyerahkan explorer yang sudah dapat dipakai integrator.

Output wajib:

- Peta Mars interaktif.
- Layer control.
- Klik lokasi.
- GeoJSON candidate markers.
- Legend dan attribution.

## Anggota 4 — Comparison & Ranking Frontend Engineer

Fokus: menerjemahkan output AI menjadi penjelasan yang mudah dipahami.

### Hari 1

- [ ] Membuat komponen ranking dashboard dengan fixture JSON.
- [ ] Menampilkan rank, nama kandidat, score, dan data coverage.
- [ ] Membuat komponen contribution chart.
- [ ] Membuat comparison card Earth vs Mars.
- [ ] Membuat area untuk match, mismatch, dan limitations.
- [ ] Membuat route shareable `/compare/[scenarioId]/[candidateId]`.

### Hari 2

- [ ] Menghubungkan UI ke JSON/API final.
- [ ] Menampilkan raw value, unit, dan normalized value.
- [ ] Menampilkan kontribusi skor per fitur.
- [ ] Membuat weight control sederhana jika waktu cukup.
- [ ] Menambahkan label “data-derived similarity, not mission-site approval”.
- [ ] Memastikan kandidat dengan data parsial diberi status jelas.

Output wajib:

- Ranking dashboard.
- Comparison workspace.
- Contribution chart.
- Limitations card.
- Shareable comparison page.

## Anggota 5 — Scientific Storytelling, Content & QA

Fokus: memastikan proyek memenangkan Validity, Relevance, dan Impact, bukan hanya tampil bagus.

### Hari 1

- [ ] Menulis copy landing page: masalah, solusi, cara kerja, dan impact.
- [ ] Menulis deskripsi Mars scenario.
- [x] Menulis operational hypothesis untuk tiap kandidat Bumi.
- [x] Menulis limitation statement untuk setiap kandidat.
- [x] Menulis disclaimer ilmiah utama.
- [x] Memverifikasi sitasi dan metadata dataset dari anggota data.
- [x] Membuat demo script kasar 90 detik.

### Hari 2

- [x] Membuat halaman methodology/provenance.
- [x] Memastikan setiap skor memiliki sumber dan caveat.
- [x] Memeriksa klaim berlebihan seperti “best landing site”, “proven analog”, atau “AI discovery”.
- [x] Menjalankan checklist rubrik NASA Space Apps.
- [ ] Menguji alur pengguna dari landing page sampai comparison.
- [x] Menulis README/submission description.
- [ ] Memimpin rehearsal demo dan mencatat bug prioritas.

Output wajib:

- Landing-page copy.
- Methodology/provenance content.
- Rubric checklist.
- Demo script.
- Submission description.

## Dependency Contract

Agar tidak terjadi bottleneck, gunakan jadwal handoff berikut:

| Waktu | Handoff |
|---|---|
| Hari 1, menit 20 | Product Lead membekukan scenario, kandidat, fitur, dan format JSON. |
| Hari 1, jam ke-1 | Backend owner membuat Supabase schema, seed, dan kontrak respons API; frontend memakai fixture dengan bentuk kontrak yang sama. |
| Hari 1, jam ke-2 | Data Engineer memberi fixture JSON; frontend mulai integrasi tanpa menunggu data final. |
| Hari 1, akhir sesi | Map, ranking, comparison, dan landing page sudah berjalan dengan mock data. |
| Hari 2, jam ke-1 | Data Engineer menyerahkan ranking final dan provenance. |
| Hari 2, jam ke-2 | Backend owner memvalidasi/impor data final; integrator mengganti fixture dengan API production. |
| Hari 2, jam ke-3 | QA, citation review, mobile check, dan bug fixing. |
| Hari 2, jam ke-4 | Deploy Vercel, rehearsal, dan submission assets. |

## Fitur Prioritas

### Wajib selesai

- [ ] Landing page.
- [ ] Mars map dengan pan, zoom, click.
- [ ] Tiga layer medan.
- [ ] Location inspector.
- [ ] Ranking lima kandidat Bumi.
- [ ] Earth–Mars comparison.
- [ ] Penjelasan skor per fitur.
- [ ] Source/provenance dan limitations.
- [ ] Deployment Vercel.
- [ ] Supabase read-only dan API production yang menampilkan `modelRunId`, citation, serta fallback data.

### Hanya jika waktu tersisa

- [ ] Adjustable feature weights.
- [ ] Export comparison card.
- [ ] Animasi UI.
- [ ] Dark/light theme.
- [ ] Moon mode placeholder.
- [ ] Login atau user workspace.

Jika satu bagian terlambat, jangan menunggu: pertahankan fixture data dan selesaikan alur demo. Untuk kompetisi, satu alur lengkap dan kredibel jauh lebih kuat daripada banyak fitur yang setengah jadi.
