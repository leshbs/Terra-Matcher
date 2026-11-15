create table if not exists public.location_profiles (
  model_run_id text not null references public.model_runs(id),
  location_id text not null,
  location_kind text not null check (location_kind in ('scenario', 'candidate')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_km double precision not null check (radius_km > 0),
  summary text not null,
  operational_hypothesis text not null,
  limitations jsonb not null,
  source_dataset_ids jsonb not null,
  analysis_resolution_m integer not null check (analysis_resolution_m > 0),
  local_window_km double precision not null check (local_window_km > 0),
  quality_flag text not null check (quality_flag in ('source-backed-derived', 'no-data')),
  features jsonb not null,
  primary key (model_run_id, location_id)
);

create index if not exists location_profiles_model_run_kind_idx
  on public.location_profiles (model_run_id, location_kind);

alter table public.location_profiles enable row level security;
create policy "public read ready location profiles"
  on public.location_profiles for select to anon
  using (exists (select 1 from public.model_runs where id = model_run_id and status = 'ready'));
