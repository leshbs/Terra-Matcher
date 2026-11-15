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

create index if not exists explorer_grid_samples_run_location_idx
  on public.explorer_grid_samples (model_run_id, location_id);

alter table public.explorer_grid_samples enable row level security;
create policy "public read ready explorer samples"
  on public.explorer_grid_samples for select to anon
  using (exists (select 1 from public.model_runs where id = model_run_id and status = 'ready'));
