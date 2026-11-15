-- Versioned map windows for the Explorer production API.
-- A scenario has exactly one Mars reference window and one window per candidate.

alter table public.model_runs
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'ready', 'retired'));

create table if not exists public.explorer_windows (
  id text primary key,
  scenario_id text not null references public.scenarios(id),
  candidate_id text references public.candidates(id),
  model_run_id text not null references public.model_runs(id),
  body text not null check (body in ('mars', 'earth')),
  name text not null,
  kind text not null check (kind in ('reference-scenario', 'candidate')),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  center_latitude double precision not null check (center_latitude between -90 and 90),
  radius_km double precision not null check (radius_km > 0),
  dataset_id text not null references public.datasets(id),
  operational_hypothesis text not null,
  limitations jsonb not null check (jsonb_typeof(limitations) = 'array' and jsonb_array_length(limitations) > 0),
  median_slope_deg double precision not null check (median_slope_deg >= 0),
  terrain_roughness_m double precision not null check (terrain_roughness_m >= 0),
  relative_relief_m double precision not null check (relative_relief_m >= 0),
  created_at timestamptz not null default now(),
  check (
    (candidate_id is null and body = 'mars' and kind = 'reference-scenario') or
    (candidate_id is not null and body = 'earth' and kind = 'candidate')
  )
);

create unique index if not exists explorer_windows_reference_per_run
  on public.explorer_windows (scenario_id, model_run_id)
  where candidate_id is null;

create unique index if not exists explorer_windows_candidate_per_run
  on public.explorer_windows (scenario_id, model_run_id, candidate_id)
  where candidate_id is not null;

alter table public.explorer_windows enable row level security;

drop policy if exists "public read ready explorer windows" on public.explorer_windows;
create policy "public read ready explorer windows"
  on public.explorer_windows for select to anon
  using (
    exists (
      select 1 from public.model_runs
      where model_runs.id = explorer_windows.model_run_id
        and model_runs.status = 'ready'
    )
  );
