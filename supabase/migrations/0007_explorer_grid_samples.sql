create table if not exists public.explorer_grid_samples (
  id text primary key,
  model_run_id text not null references public.model_runs(id),
  location_id text not null,
  dataset_id text not null references public.datasets(id),
  offset_east_km double precision not null,
  offset_north_km double precision not null,
  slope double precision not null check (slope >= 0),
  roughness double precision not null check (roughness >= 0),
  relative_relief double precision not null check (relative_relief >= 0),
  quality_flag text not null check (quality_flag = 'source-backed-derived'),
  unique (model_run_id, location_id, offset_east_km, offset_north_km)
);

-- Preserve the 150 source-backed samples imported by the earlier Explorer
-- prototype, whose equivalent identifier was named `window_id` and pointed
-- at the now-removed explorer_windows table.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'explorer_grid_samples'
      and column_name = 'window_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'explorer_grid_samples'
      and column_name = 'location_id'
  ) then
    alter table public.explorer_grid_samples rename column window_id to location_id;
    alter table public.explorer_grid_samples drop constraint if exists explorer_grid_samples_window_id_fkey;
    alter table public.explorer_grid_samples drop constraint if exists explorer_grid_samples_window_id_offset_east_km_offset_north_key;
    alter table public.explorer_grid_samples
      add constraint explorer_grid_samples_model_run_location_offset_key
      unique (model_run_id, location_id, offset_east_km, offset_north_km);
  end if;
end $$;

create index if not exists explorer_grid_samples_run_location_idx
  on public.explorer_grid_samples (model_run_id, location_id);

alter table public.explorer_grid_samples enable row level security;
drop policy if exists "public read ready explorer samples" on public.explorer_grid_samples;
create policy "public read ready explorer samples"
  on public.explorer_grid_samples for select to anon
  using (exists (select 1 from public.model_runs where id = model_run_id and status = 'ready'));
