# Struktur Folder & Kepemilikan Tim

Dokumen ini adalah kontrak kerja sebelum repository Git dibuat. Tujuannya mengurangi merge conflict: satu folder kerja memiliki satu pemilik utama. Anggota lain boleh membuat pull request atau perubahan kecil hanya setelah memberi tahu pemilik folder.

## Struktur awal

```text
nasa-space/
├─ app/                         # Anggota 1: routes, layout, API Route Handlers
├─ components/
│  ├─ mission-control/          # Anggota 5: landing page content sections
│  ├─ explorer/                 # Anggota 3: map, layers, inspector
│  ├─ comparison/               # Anggota 4: ranking dan Earth–Mars comparison
│  ├─ science/                  # Anggota 5: provenance, caveat, methodology UI
│  └─ ui/                       # Anggota 1: reusable shared primitives
├─ lib/
│  ├─ api/                      # Anggota 1: response/error helpers
│  ├─ db/                       # Anggota 1: Supabase queries and server client
│  ├─ domain/                   # Anggota 1: Zod schema, types, similarity helpers
│  └─ map/                      # Anggota 3: layer definitions and map constants
├─ pipeline/                    # Anggota 2: all offline gathering/training/export code
│  ├─ config/
│  ├─ notebooks/
│  ├─ src/terra_analog/
│  └─ tests/
├─ public/
│  ├─ data/demo/                # Anggota 1 only: final web-readable JSON fallback
│  ├─ layers/                   # Anggota 3 only: web map layer assets/manifest
│  └─ images/                   # Anggota 5 only: curated marketing/science imagery
├─ scripts/                      # Anggota 1: controlled import/verification scripts
├─ supabase/migrations/          # Anggota 1 only: ordered schema migrations
├─ tests/
│  ├─ unit/                     # Owner follows source module owner
│  ├─ component/                # Owner follows component owner
│  └─ e2e/                      # Anggota 1, with QA cases from Anggota 5
├─ docs/                         # Anggota 1 owns architecture; Anggota 5 owns copy/rubric edits
├─ PEMBAGIAN-PERAN.md
└─ FOLDER-OWNERSHIP.md
```

## Aturan khusus `public/`

`public/` adalah aset yang langsung terpublikasi. Karena itu tidak boleh dipakai sebagai folder kerja bersama atau lokasi data mentah.

- Anggota 2 menyimpan output pipeline sementara di luar `public/`, misalnya `pipeline/outputs/<model-run-id>/` (di-ignore bila besar).
- Anggota 2 menyerahkan satu paket tervalidasi kepada Anggota 1: `model_manifest.json`, `datasets.json`, `locations.json`, `location-features.json`, `rankings.json`, `ranking-contributions.json`, `location-evidence.json`, dan `candidates.geojson`.
- Hanya Anggota 1 yang memindahkan/menyalin JSON fallback final ke `public/data/demo/` serta mengimpor data ke Supabase.
- Hanya Anggota 3 yang menambahkan asset peta yang benar-benar dibaca MapLibre ke `public/layers/`; asset harus dicatat di `public/layers/manifest.json`.
- Hanya Anggota 5 yang menambahkan gambar ke `public/images/`, dengan nama deskriptif dan attribution dicatat di `docs/`.
- Tidak ada file data mentah, API key, screenshot sementara, atau file bernama `final-final.*` di `public/`.

## Konvensi penamaan

- Gunakan `kebab-case` untuk file, folder, ID lokasi, dan asset web: `mars-jezero-demo.json`.
- Gunakan `PascalCase` hanya untuk komponen React: `LocationInspector.tsx`.
- Gunakan prefix tanggal/versi untuk model dan asset turunan: `2026-11-14-mvp-v1`.
- Gunakan satu manifest untuk setiap grup asset, bukan memperbarui banyak file tanpa indeks.
- Migration Supabase memakai urutan tidak berubah: `0001_initial_schema.sql`, `0002_add_evidence.sql`.

## Aturan kolaborasi Git

1. Sebelum mulai, buat atau klaim issue/tugas dan tuliskan folder yang diubah.
2. Satu pull request sebaiknya berfokus pada satu owner area; jangan mencampur refactor global dengan fitur.
3. Jangan mengubah `app/layout.tsx`, shared types, schema database, atau `public/` milik owner lain tanpa koordinasi.
4. Bila kontrak API/data berubah, Anggota 1 mengumumkan perubahan, memperbarui fixture, lalu frontend menyesuaikan. Jangan melakukan perubahan format diam-diam.
5. Selalu rebase/pull sebelum mengedit file integrasi bersama pada Hari 2.

## File integrasi bersama

File berikut memiliki risiko conflict tinggi dan hanya boleh diedit oleh Anggota 1 pada fase integrasi:

- `app/layout.tsx`
- `app/providers.tsx`
- `lib/domain/schemas.ts`
- `lib/db/queries.ts`
- `supabase/migrations/*.sql`
- `public/data/demo/*`
- `package.json`

Anggota lain mengirim perubahan yang diperlukan sebagai snippet atau pull request kecil; Anggota 1 menggabungkannya.
