-- 0004_restrict_public_provenance_access.sql
--
-- Tujuan: metadata methodology yang sudah disetujui tetap publik, sementara
-- akses baca anon ke provenance pipeline draft (ranking contributions dan
-- location evidence) ditutup sampai publikasi disetujui.
--
-- Tidak ada baris data yang dihapus atau diubah. Hanya policy SELECT anon.

-- 1. datasets: anon hanya boleh membaca dua dataset sumber yang disetujui.
drop policy if exists "public read datasets" on public.datasets;
create policy "public read approved datasets"
  on public.datasets
  for select
  to anon
  using (id in ('earth-nasadem-hgt-v001', 'mars-mola-megdr-v2'));

-- 2. model_runs: anon hanya boleh membaca run methodology yang disetujui.
drop policy if exists "public read model runs" on public.model_runs;
create policy "public read approved model runs"
  on public.model_runs
  for select
  to anon
  using (id = '2026-11-14-mvp-v1');

-- 3. ranking_contributions: hapus akses baca anon.
--    Tanpa policy SELECT untuk anon, RLS menolak semua baris.
drop policy if exists "public read ranking contributions" on public.ranking_contributions;

-- 4. location_evidence: hapus akses baca anon.
drop policy if exists "public read location evidence" on public.location_evidence;

-- Opsional (pertahanan berlapis): cabut juga grant SELECT tingkat tabel.
-- Aktifkan hanya jika ketua menyetujui pencabutan grant, bukan hanya policy.
-- revoke select on public.ranking_contributions from anon;
-- revoke select on public.location_evidence from anon;