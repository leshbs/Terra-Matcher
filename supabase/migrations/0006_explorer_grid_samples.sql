-- Source-backed 5x5 terrain grids for Explorer windows.

create table if not exists public.explorer_grid_samples (
  id text primary key,
  window_id text not null references public.explorer_windows(id) on delete cascade,
  model_run_id text not null references public.model_runs(id),
  dataset_id text not null references public.datasets(id),
  offset_east_km double precision not null,
  offset_north_km double precision not null,
  slope double precision not null check (slope >= 0),
  roughness double precision not null check (roughness >= 0),
  relative_relief double precision not null check (relative_relief >= 0),
  quality_flag text not null check (quality_flag = 'source-backed-derived'),
  created_at timestamptz not null default now(),
  unique (window_id, offset_east_km, offset_north_km)
);

create index if not exists explorer_grid_samples_window_run_idx
  on public.explorer_grid_samples (window_id, model_run_id);

alter table public.explorer_grid_samples enable row level security;

drop policy if exists "public read ready explorer samples" on public.explorer_grid_samples;
create policy "public read ready explorer samples"
  on public.explorer_grid_samples for select to anon
  using (
    exists (
      select 1 from public.explorer_windows
      join public.model_runs on model_runs.id = explorer_windows.model_run_id
      where explorer_windows.id = explorer_grid_samples.window_id
        and explorer_windows.model_run_id = explorer_grid_samples.model_run_id
        and model_runs.status = 'ready'
    )
  );
