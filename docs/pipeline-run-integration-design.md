# Desain Integrasi Pipeline Run

Status: Draft — menunggu keputusan dan persetujuan tim.
Branch: feat/pipeline-run-metadata-design
Baseline commit: f7de4d9530ef3ce5e98edc91a74066f83c298801

## 1. Tujuan dan batasan

Mengintegrasikan hasil pipeline Terra Analog Mission Control tanpa
menimpa fixture atau mengekspos hasil yang belum disetujui.

Skor mengukur kemiripan fitur medan, bukan probabilitas, penilaian
keselamatan, validasi analog ilmiah, atau rekomendasi lokasi misi.
MVP tidak memodelkan gravitasi, atmosfer, atau radiasi.

Dokumen ini bukan persetujuan publikasi dan tidak menjalankan impor.

## 2. Kondisi aplikasi saat ini

- Repo memiliki satu migrasi SQL: supabase/migrations/0001_init.sql.
- Migrasi pada baseline memiliki scenarios.data_mode dan candidates.name.
- Pemeriksaan file lokal menunjukkan isi sama dengan HEAD setelah
  normalisasi akhir baris. Schema Supabase terpasang belum diperiksa.
- Seed memiliki pembuka CTE fixture_features yang lengkap.
- API skenario mengembalikan semua skenario, diurutkan berdasarkan ID.
- Dashboard otomatis memilih skenario pertama.
- API kandidat hanya mendukung skenario, run, dan versi model fixture.
- Run pipeline belum didukung oleh API kandidat.
- Migrasi repo mengaktifkan RLS dan mendefinisikan kebijakan SELECT anon
  yang mengizinkan semua baris pada scenarios, candidates, dan candidate_scores.
  Kebijakan pada Supabase terpasang belum diperiksa.
- Filter API saja tidak cukup untuk melindungi data draft dari akses
  langsung melalui Supabase.

## 3. Fixture yang wajib dipertahankan

- Scenario: mars-reference-fixture-v1
- Run: fixture-run-v1
- Model version: fixture-demo-v1
- Kandidat dan skor sintetis existing harus tetap utuh.
- Jangan menggabungkan kandidat pipeline dan fixture berdasarkan nama.
- Jangan menggunakan label production sebagai bukti persetujuan ilmiah.

## 4. Paket pipeline yang ditinjau

Run ID: 2026-11-14-mvp-v1
Area referensi: Gale Crater / Aeolis Palus

Sembilan artefak:
- location-features.json
- processing-report.json
- study-population-features.json
- model_manifest.json
- rankings.json
- ranking-contributions.json
- location-evidence.json
- candidates.geojson
- validation-report.json

Validator read-only melaporkan coreChecks: passed dan
publicationReadiness: not_assessed. Ini bukan verifikasi raster,
validasi ilmiah, atau persetujuan publikasi.

Hanya SHA-256 validation-report.json yang terkonfirmasi cocok dengan
ZIP handoff. Hash delapan artefak lain tercatat lokal, tetapi
kecocokannya dengan ZIP belum terkonfirmasi.

Execution commit, versi model keseluruhan, dan generated_at asli
belum dikonfirmasi. Jangan menurunkannya dari nama run atau tanggal file.

## 5. Struktur data yang diusulkan

Nama dan bentuk tabel berikut belum menjadi keputusan final.

### Metadata run

Usulkan entitas model_runs yang menyimpan:
- Run ID dan scenario ID pipeline yang berbeda dari fixture.
- Versi model keseluruhan dan execution commit yang terkonfirmasi.
- generated_at asli beserta sumber buktinya.
- imported_at terpisah dari generated_at.
- Definisi fitur, satuan, bobot, dan normalisasi.
- Identitas manifest dan populasi normalisasi.
- Limitations khusus run.
- Status persetujuan publikasi dan catatan pihak yang menyetujuinya.

Kesiapan dukungan API merupakan kondisi aplikasi yang terpisah dari
persetujuan publikasi. Jangan mengandalkan satu boolean untuk keduanya.

### Artefak, fitur, dan evidence

Usulkan penyimpanan terkait run untuk:
- Inventaris nama artefak, SHA-256 lokal, dan status verifikasi handoff.
- Provenance sumber serta parameter pemrosesan yang tersedia.
- Fitur mentah referensi dan kandidat.
- Nilai hasil normalisasi, kontribusi per fitur, dan ranking.
- Identitas lokasi/sampel dan evidence yang tersedia.

Fitur dan evidence yang bergantung pada run tidak boleh ditempatkan
sebagai atribut global kandidat tanpa identitas run.

Paket mentah tetap di lokasi nonpublik dan di-ignore Git.
Jangan memindahkannya ke public/ atau melakukan commit paket.

## 6. Kontrak API dan dashboard yang diusulkan

- Pilih run secara eksplisit; jangan otomatis menggunakan run terbaru.
- Tentukan pemetaan skenario ke run aktif yang telah disetujui.
- API daftar skenario hanya menampilkan skenario yang dipublikasikan
  dan didukung aplikasi.
- Kandidat harus divalidasi terhadap run, versi model, dan skenario
  terpilih, bukan literal fixture untuk semua mode.
- Respons mempertahankan metadata run dan limitations yang benar.
- Tentukan skenario default secara eksplisit, bukan berdasarkan urutan ID.
- Data pipeline tidak boleh diam-diam diganti dengan fixture saat gagal.
- Tampilan skor tidak boleh menyiratkan probabilitas atau rekomendasi misi.
- Pembulatan tampilan tidak mengubah nilai tersimpan.

## 7. Akses dan publikasi

Jangan memasukkan data draft ke tabel dengan baca anon menggunakan
kebijakan using (true).

Sebelum staging database, tim harus memilih desain penyimpanan privat
atau kebijakan RLS yang membatasi seluruh data terkait run.
Perlindungan harus mencakup metadata, kandidat, skor, fitur, dan evidence.

Uji akses anon langsung, tidak hanya akses melalui endpoint Next.js.
Jangan menonaktifkan RLS, membagikan key, atau memakai service_role.
Jalur penulisan berwenang belum ditentukan dalam dokumen ini.

## 8. Kontrak importer yang diusulkan

- Default dry-run; tidak menulis data.
- Periksa kelengkapan paket, identitas run, referensi antarartefak,
  fitur, kontribusi, provenance, dan hash.
- Blokir impor jika metadata wajib belum terkonfirmasi.
- generated_at wajib merupakan waktu pembuatan asli yang valid.
  Jangan menggunakan waktu impor, filesystem, atau created_at.
- Simpan imported_at sebagai waktu impor terpisah.
- Fitur mentah tetap dalam derajat/meter.
- Konversi skor paket 0–100 menjadi skor database 0–1 tepat sekali.
- GeoJSON menggunakan urutan koordinat [longitude, latitude].
- Jangan mengubah angka paket atau metode ranking diam-diam.
- Impor satu paket secara transaksional; kegagalan harus rollback.
- Paket identik untuk identitas run yang sama menjadi no-op.
- Konten berbeda untuk identitas run yang sama harus ditolak,
  bukan menimpa data.
- Tetapkan identitas paket secara deterministik dari inventaris artefak;
  jangan menganggap hash ZIP sebagai hash masing-masing artefak.
- Impor tidak otomatis memberikan persetujuan publikasi.
- Aktivasi run merupakan langkah terpisah yang memerlukan persetujuan.

## 9. Rencana pengujian

- Regresi fixture: identitas, skor, metadata, dan limitations tetap.
- Skenario tanpa dukungan run tidak muncul sebagai pilihan/default.
- Data draft tidak dapat dibaca anon, termasuk melalui Supabase langsung.
- Tolak mismatch run/model/scenario dan evidence lintas run.
- Tolak fitur/koordinat/skor invalid serta timestamp tidak valid.
- Verifikasi konversi skor dan urutan koordinat.
- Uji rollback, impor ulang identik, dan konflik konten.
- Uji dashboard untuk loading, error, empty, dan metadata mismatch.

Baseline pengujian:
- Targeted validator/ranking: 28 lulus.
- Full unittest suite: 36 test, 35 lulus, 1 error karena file
  data/training/raw/mars/megt00n090hb.hdr tidak tersedia.
- Jangan menyatakan full suite hijau, membuat raster pengganti,
  atau menambahkan skip untuk menutupi error tersebut.

## 10. Keputusan yang masih dibutuhkan

- Scenario ID pipeline yang disetujui.
- Execution commit, versi model, dan generated_at asli.
- Verifikasi delapan hash artefak lainnya terhadap handoff.
- Kebijakan persetujuan publikasi dan pihak penanggung jawab.
- Desain akses privat/RLS dan jalur penulisan berwenang.
- Bentuk final tabel, metadata, serta kontrak API.
- Pemetaan run aktif dan skenario default.

## 11. Urutan pelaksanaan

1. Review dan setujui desain serta metadata yang masih tertunda.
2. Periksa schema Supabase terpasang tanpa membagikan kredensial.
3. Rancang migrasi lanjutan; jangan mengubah sejarah migrasi secara diam-diam.
4. Implementasikan dan uji pembatasan akses sebelum staging data draft.
5. Implementasikan dukungan API/dashboard dengan regresi fixture.
6. Implementasikan importer dry-run dan pengujian transaksi/idempotensi.
7. Lakukan impor berwenang setelah persyaratan terpenuhi.
8. Publikasikan dan aktifkan run melalui persetujuan terpisah.

Sampai langkah-langkah tersebut disetujui, tidak ada impor atau aktivasi
run pipeline di production.
