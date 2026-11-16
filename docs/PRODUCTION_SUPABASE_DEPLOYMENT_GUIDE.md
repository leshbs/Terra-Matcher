# Production Supabase & Web Deployment Guide

Panduan ini menerapkan data Comparison/Ranking dan Explorer ke proyek Supabase yang sudah ada, lalu mengaktifkan web dalam mode API produksi. Ikuti urutan ini; jangan gunakan `supabase db push` untuk proyek hosted yang sudah dipakai.

## 1. Siapkan akses dan rahasia

Siapkan dari dashboard Supabase proyek target:

- Project URL.
- Anon/publishable key.
- Service-role key, hanya untuk runtime server Vercel.
- Akses SQL Editor (role yang dapat membuat tabel, policy, dan menulis seed).

Jangan tempel service-role key ke file, commit, browser, atau chat. Jangan membuat variabel bernama `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

Siapkan URL deployment, misalnya `https://terra-analog.example.vercel.app`. URL ini diperlukan oleh loader server-side Comparison.

## 2. Verifikasi kondisi awal database

Di **Supabase SQL Editor**, jalankan query read-only berikut dan simpan hasilnya pada catatan deployment:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select id, status, analysis_resolution_m, local_window_km, transformation_version
from public.model_runs
order by id;
```

Expected baseline: migrasi historis `0001`–`0004` sudah pernah diterapkan secara manual. Jika tabel dasar seperti `scenarios`, `candidate_scores`, `datasets`, atau `model_runs` tidak ada, berhenti dan rekonsiliasi sejarah database terlebih dahulu. Jangan mencoba memperbaikinya dengan `db push`.

## 3. Terapkan migrasi baru secara manual

Pada SQL Editor, buka dan jalankan satu file per satu, persis dalam urutan berikut:

1. `supabase/migrations/0005_model_run_readiness.sql`
2. `supabase/migrations/0006_location_profiles.sql`
3. `supabase/migrations/0007_explorer_grid_samples.sql`

Setelah setiap eksekusi, pastikan SQL Editor melaporkan sukses sebelum melanjutkan. Jangan menjalankan `0001`–`0004` lagi kecuali hasil audit langkah 2 membuktikan database memang belum pernah memilikinya. Urutan penting karena policy RLS pada migrasi lama dan baru saling menggantikan.

## 4. Siapkan dan jalankan seed produksi

Seed yang harus dijalankan adalah:

```text
supabase/seed/0003_production_seed.sql
```

File ini memuat profil Mars, lima kandidat, ranking, kontribusi, evidence, metadata dataset, dan 150 sampel Explorer. Bila seed perlu digenerasi ulang dari artefak pipeline, jalankan dahulu dari worktree dengan path data yang benar:

```powershell
node scripts/build-production-seed.mjs `
  --training-root 'C:\Users\Lesharo Bladen S\.codex\worktrees\training-data-catalog\nasa-space\data\training' `
  --output 'supabase\seed\0003_production_seed.sql'

node --test tests/unit/explorer-grid-seed.test.mjs
```

Jalankan isi `0003_production_seed.sql` di SQL Editor hanya setelah migrasi `0005`–`0007` sukses. Seed memakai upsert sehingga aman untuk rerun pada data produksi yang sama; tetap lakukan backup/export database sebelum perubahan pertama.

## 5. Validasi data setelah seed

Jalankan query berikut di SQL Editor. Semua query harus memberi hasil yang sesuai sebelum deployment web.

```sql
-- Tepat satu model run yang siap dipakai.
select id, status, analysis_resolution_m, local_window_km, transformation_version
from public.model_runs
where status = 'ready';

-- Satu scenario Mars + lima kandidat source-backed.
select location_kind, count(*)
from public.location_profiles
where model_run_id = '2026-11-14-mvp-v1'
group by location_kind
order by location_kind;

-- Rank 1 sampai 5, satu model run yang sama.
select rank, candidate_id, similarity_score, model_run_id
from public.candidate_scores
where scenario_id = 'mars-gale-aeolis-palus-v1'
order by rank;

-- Tiga kontribusi per kandidat.
select candidate_id, count(*) as contribution_count
from public.ranking_contributions
where scenario_id = 'mars-gale-aeolis-palus-v1'
  and model_run_id = '2026-11-14-mvp-v1'
group by candidate_id
order by candidate_id;

-- Enam window, masing-masing 25 sampel.
select location_id, count(*) as sample_count
from public.explorer_grid_samples
where model_run_id = '2026-11-14-mvp-v1'
group by location_id
order by location_id;

-- Tidak boleh ada quality flag selain source-backed-derived.
select quality_flag, count(*)
from public.explorer_grid_samples
where model_run_id = '2026-11-14-mvp-v1'
group by quality_flag;
```

Expected:

- satu row `ready` untuk `2026-11-14-mvp-v1`;
- `scenario = 1`, `candidate = 5`;
- rank `1, 2, 3, 4, 5`;
- lima row kandidat dengan `contribution_count = 3`;
- enam row lokasi dengan `sample_count = 25`;
- hanya `source-backed-derived`.

Jika satu saja tidak sesuai, jangan deploy mode API. Perbaiki database atau seed dulu; endpoint sengaja akan mengembalikan 503 daripada menyajikan fixture sebagai produksi.

## 6. Konfigurasi environment Vercel

Tambahkan variabel ini pada Environment Variables untuk Production (dan Preview jika preview juga harus memeriksa API nyata):

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
COMPARISON_DATA_SOURCE=api
EXPLORER_DATA_SOURCE=api
COMPARISON_API_ORIGIN=https://<production-domain>
NEXT_PUBLIC_APP_URL=https://<production-domain>
```

Aturan penting:

- Jangan gunakan `fixture` di Production. Aplikasi menolak nilai `fixture`, kosong, atau tidak dikenal di luar `development`/`test`; tidak ada fallback diam-diam ke fixture.
- `COMPARISON_API_ORIGIN` harus URL publik HTTPS tanpa trailing slash.
- `SUPABASE_SERVICE_ROLE_KEY` tidak boleh diberi prefix `NEXT_PUBLIC_`.
- URL dan anon key boleh berada di browser; service-role key tidak boleh.

Setelah menyimpan variabel, lakukan redeploy karena environment dibaca saat build/runtime.

## 7. Verifikasi repository sebelum deploy

Jalankan dari worktree:

```powershell
node --test tests/unit/*.test.mjs tests/api/*.test.mjs
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e -- tests/e2e/main-web-flow.spec.ts
```

E2E lokal menggunakan mode fixture secara sengaja agar tidak memerlukan secret. E2E tersebut memverifikasi navigasi canonical, bukan kebenaran data Supabase produksi.

Selain itu, jalankan build dengan konfigurasi production-like berikut sebelum deploy. Ini memastikan halaman tidak dapat kembali ke fixture saat variabel environment tidak lengkap:

```powershell
$env:COMPARISON_DATA_SOURCE = 'api'
$env:EXPLORER_DATA_SOURCE = 'api'
$env:COMPARISON_API_ORIGIN = 'https://<production-domain>'
npm run build
```

## 8. Deploy dan smoke test API mode

Deploy branch integrasi ke Vercel melalui workflow tim. Setelah status deployment `Ready`, buka terminal baru dan set URL deployment:

```powershell
$origin = 'https://<production-domain>'
```

Periksa endpoint tanpa menampilkan secret:

```powershell
$rankings = Invoke-RestMethod "$origin/api/scenarios/mars-gale-aeolis-palus-v1/rankings"
$rankings.meta
$rankings.data.model
$rankings.data.candidates | Select-Object rank, id, name, similarityScore

$explorer = Invoke-RestMethod "$origin/api/scenarios/mars-gale-aeolis-palus-v1/explorer"
$explorer.meta
$explorer.data.windows | Select-Object id, body, rank, score, @{n='points';e={$_.points.Count}}
$explorer.data.cells.features.Count
```

Expected:

- kedua endpoint HTTP 200;
- `meta.dataMode` bernilai `production`;
- model run sama pada kedua endpoint;
- ranking mempunyai lima kandidat terurut;
- Explorer mempunyai enam window, 25 point per window, dan 150 cell;
- disclaimer ranking persis `data-derived similarity, not mission-site approval`.

Periksa kegagalan aman juga:

```powershell
try {
  Invoke-WebRequest "$origin/api/scenarios/does-not-exist/rankings" -ErrorAction Stop
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `404`, bukan fixture response.

## 9. Smoke test browser produksi

Dalam browser incognito, buka empat halaman berikut:

1. `/`
2. `/compare`
3. `/compare/mars-gale-aeolis-palus-v1/<candidate-rank-1-id>`
4. `/explore`

Centang:

- [ ] Model run sama pada beranda, Ranking, detail kandidat, dan Explorer.
- [ ] Kandidat peringkat 1 serta skornya sama pada beranda, Ranking, dan detail.
- [ ] Disclaimer ilmiah terlihat dan sama.
- [ ] Explorer memuat enam window; tiap window memiliki 25 sampel.
- [ ] Pemilihan Mars/Bumi, layer, zoom, inspector, attribution, dan retry error dapat digunakan.
- [ ] Tidak ada banner fixture/demo dalam deployment Production.

## 10. Bila terjadi masalah

| Gejala | Tindakan aman |
|---|---|
| `503 RANKINGS_UNAVAILABLE` | Periksa environment Vercel dan satu model run `ready`; jangan mengaktifkan fixture. |
| `503 INVALID_PROVENANCE` / `INVALID_EXPLORER_DATA` | Ulangi query langkah 5; cek profil, tiga kontribusi per kandidat, dan 25 sampel per lokasi. |
| `/explore` gagal tetapi ranking berhasil | Periksa `explorer_grid_samples` dan kecocokan `dataset_id` terhadap profile feature source. |
| Build Vercel gagal karena font | Commit saat ini sudah memakai fallback font sistem; pastikan deploy memakai commit terbaru. |
| Perlu rollback cepat UI | Roll back deployment Vercel ke deployment sebelumnya. Jangan menghapus data Supabase sebagai rollback pertama. |

Untuk rollback data, buat snapshot/export dahulu dan gunakan SQL perubahan yang dipahami tim. Jangan jalankan `supabase db reset` pada proyek hosted.

## Completion record

Simpan bersama release:

- URL deployment dan deployment ID;
- waktu penerapan tiap migration dan seed;
- hasil query langkah 5;
- model run ID dan top candidate ID/score;
- hasil smoke test endpoint serta empat halaman;
- nama operator, reviewer, dan keputusan rollback bila ada.
