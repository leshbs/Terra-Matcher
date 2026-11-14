# Pembagian Peran Tim — Terra Analog Mission Control

**Waktu:** 2 hari × 4 jam × 5 anggota = 40 person-hours.  
**MVP:** Mars-first, static-first, explainable similarity ranking.

## Aturan kerja agar tidak saling menunggu

- Bekukan scope pada 20 menit pertama: satu Mars scenario, lima kandidat Bumi, tiga fitur (`slope`, `terrain roughness`, `relative relief`).
- Semua frontend mulai memakai fixture dengan kontrak API yang sama; jangan menunggu data AI final.
- Ikuti ownership di `FOLDER-OWNERSHIP.md`: satu folder mempunyai satu pemilik utama.
- Anggota 2 tidak menulis langsung ke `public/`; ia menyerahkan paket data tervalidasi kepada Anggota 1.
- Hindari fitur baru setelah Hari 1 berakhir. Jika ada keterlambatan, pertahankan fixture dan selesaikan demo path utama.

## Anggota 1 — Product Lead, Full-stack Integrator & Backend Owner

**Fokus:** scope, Supabase, Next.js API, integrasi, deployment, dan demo final. Backend hanya menyajikan output AI yang telah difinalisasi, tanpa training atau pemrosesan raster saat runtime.

### Hari 1

- [ ] Membekukan scenario, kandidat, fitur, ID, dan kontrak data/API.
- [ ] Menyiapkan Next.js, environment template, Supabase, dan seed fixture.
- [ ] Membuat tabel `datasets`, `model_runs`, `locations`, `location_features`, `rankings`, `ranking_contributions`, dan `location_evidence`.
- [ ] Menetapkan akses publik read-only; tidak ada anonymous write atau service-role key di browser.
- [ ] Membuat Route Handlers: `/api/scenarios`, `/api/scenarios/[scenarioId]`, `/api/scenarios/[scenarioId]/rankings`, `/api/candidates/[candidateId]`, `/api/compare`.
- [ ] Menjaga file integrasi bersama: `package.json`, `app/layout.tsx`, schema, API, dan `public/data/demo/`.

### Hari 2

- [ ] Memvalidasi dan mengimpor paket final Anggota 2 ke Supabase.
- [ ] Memastikan ranking memuat `modelRunId`, versi model, source/provenance, coverage, dan contributions.
- [ ] Menyediakan fallback JSON statis bila Supabase gagal.
- [ ] Mengintegrasikan semua UI, menangani invalid ID/weight, smoke test, deploy Vercel, dan rehearsal.

**Output:** API production, database read-only, fallback demo data, aplikasi terintegrasi, URL `.vercel.app`, demo script.

## Anggota 2 — Data & AI Engineer

**Fokus:** data sumber, feature engineering, similarity score, validasi, dan paket model yang dapat dilacak.

### Hari 1

- [ ] Mencatat provider, produk, URL, resolusi, unit, lisensi, dan citation dalam `datasets.json`.
- [ ] Menyiapkan satu Mars scenario dan lima kandidat Bumi.
- [ ] Menghasilkan raw value, unit, dataset ID, normalized value, dan quality flag untuk tiga fitur.
- [ ] Menyediakan fixture `locations.json` dan `location-features.json`.
- [ ] Menyimpan kode/data kerja di `pipeline/`, bukan `public/`.

### Hari 2

- [ ] Menjalankan weighted similarity ranking dan menghasilkan contribution per fitur.
- [ ] Menjalankan sanity check serta memastikan score/coverage valid.
- [ ] Menyerahkan paket final maksimal awal Hari 2 kepada Anggota 1:

```text
model_manifest.json
datasets.json
locations.json
location-features.json
rankings.json
ranking-contributions.json
location-evidence.json
candidates.geojson
```

**Output:** pipeline reproducible dan paket data tervalidasi; tidak mengubah database atau file web production secara langsung.

## Anggota 3 — Map & Explorer Frontend Engineer

**Fokus:** peta Mars, kontrol layer, dan location inspector.

### Hari 1

- [ ] Membuat `/explore`, MapLibre, pan/zoom/reset/click, serta mock GeoJSON.
- [ ] Membuat `LayerControl` dan tiga layer: elevation, slope, roughness.
- [ ] Membuat selected state dan inspector dengan fixture API.

### Hari 2

- [ ] Mengganti mock dengan `candidates.geojson`/API final.
- [ ] Menambahkan legend, unit, attribution, responsive bottom sheet, serta empty/error state.
- [ ] Menaruh asset peta yang dipakai web hanya di `public/layers/`; memperbarui `public/layers/manifest.json`.

**Output:** peta interaktif, layer controls, markers, inspector, dan attribution.

## Anggota 4 — Comparison & Ranking Frontend Engineer

**Fokus:** ranking dashboard dan Earth–Mars comparison yang dapat dijelaskan.

### Hari 1

- [ ] Membuat ranking list dengan rank, score, coverage, dan fixture API.
- [ ] Membuat contribution chart dan comparison card Earth vs Mars.
- [ ] Membuat route `/compare/[scenarioId]/[candidateId]`.

### Hari 2

- [ ] Menghubungkan ranking/comparison ke API final.
- [ ] Menampilkan raw value, unit, normalized value, match/mismatch, evidence, dan limitations.
- [ ] Menambahkan label “data-derived similarity, not mission-site approval”.
- [ ] Menambahkan weight control hanya jika MVP utama sudah lengkap.

**Output:** ranking dashboard, comparison workspace, chart, limitations card, dan route shareable.

## Anggota 5 — Scientific Storytelling, Content & QA

**Fokus:** impact, validity, relevance, content, citation review, dan quality assurance.

### Hari 1

- [ ] Menulis landing-page copy, Mars scenario description, value proposition, dan impact.
- [ ] Menulis operational hypothesis serta limitation statement untuk tiap kandidat.
- [ ] Memeriksa sitasi/metadata bersama Anggota 2 dan menyiapkan methodology content.

### Hari 2

- [ ] Memastikan setiap score punya source dan caveat; memeriksa klaim berlebihan.
- [ ] Menjalankan rubric checklist NASA Space Apps dan uji alur landing → map → ranking → comparison.
- [ ] Menulis README/submission description dan memimpin rehearsal 90 detik.
- [ ] Menaruh gambar final di `public/images/` dan attribution di `docs/`.

**Output:** content, citation review, methodology/provenance copy, QA checklist, demo script, dan submission copy.

## Kontrak backend dan API

```text
Pipeline Python Anggota 2
        ↓ paket tervalidasi
Supabase PostgreSQL + static JSON/GeoJSON
        ↓
Next.js Route Handlers — Anggota 1
        ↓
Map — Anggota 3 | Ranking & comparison — Anggota 4
```

Semua endpoint memakai bentuk respons berikut:

```json
{
  "data": {},
  "meta": {
    "modelRunId": "2026-11-14-mvp-v1",
    "modelVersion": "1.0.0"
  }
}
```

Backend tidak mengunduh data NASA saat request, tidak training ulang, tidak memproses raster, dan tidak menyimpan hasil custom user. Perubahan format API hanya dilakukan Anggota 1 setelah mengumumkan perubahan ke seluruh tim.

## Jadwal handoff

| Waktu | Handoff |
|---|---|
| Hari 1, menit 20 | Anggota 1 membekukan scope, ID, feature set, dan API contract. |
| Hari 1, jam ke-1 | Anggota 1 membuat schema/seed/API fixture; frontend mulai paralel. |
| Hari 1, jam ke-2 | Anggota 2 menyerahkan fixture data; Anggota 3/4 tidak menunggu data final. |
| Hari 1, akhir sesi | Landing, map, ranking, comparison berjalan dengan mock data. |
| Hari 2, jam ke-1 | Anggota 2 menyerahkan paket data final; Anggota 5 menyelesaikan evidence/caveat. |
| Hari 2, jam ke-2 | Anggota 1 validasi/impor data final dan mengganti fixture. |
| Hari 2, jam ke-3 | QA, citation review, responsive test, dan bug fixes. |
| Hari 2, jam ke-4 | Deploy Vercel, rehearsal, dan submission. |

## Prioritas

### Wajib selesai

- [ ] Landing page, Mars map, pan/zoom/click, dan tiga layer medan.
- [ ] Location inspector, lima ranking kandidat, Earth–Mars comparison.
- [ ] Explainability: contributions, provenance, limitations, dan model version.
- [ ] Vercel deployment serta fallback demo data.

### Hanya jika waktu tersisa

- [ ] Adjustable weights.
- [ ] Export comparison card.
- [ ] Motion/theme tambahan.
- [ ] Moon placeholder atau login.
