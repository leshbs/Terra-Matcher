create table if not exists datasets (
  id text primary key,
  provider text not null,
  product text not null,
  version text not null,
  url text not null,
  access_url text not null,
  native_resolution jsonb not null,
  unit text not null,
  citation text not null,
  limitations jsonb not null
);

create table if not exists model_runs (
  id text primary key,
  analysis_resolution_m integer not null,
  local_window_km integer not null,
  transformation_version text not null,
  input_dataset_ids jsonb not null
);

alter table candidate_scores add column if not exists rank integer;
alter table candidate_scores add column if not exists data_coverage double precision;
alter table candidate_scores add column if not exists source_dataset_ids jsonb;

create table if not exists ranking_contributions (
  model_run_id text not null references model_runs(id),
  scenario_id text not null references scenarios(id),
  candidate_id text not null references candidates(id),
  feature_key text not null,
  available boolean not null,
  normalized_weight double precision not null,
  weighted_contribution double precision not null,
  feature_distance double precision not null,
  candidate_raw_value double precision,
  reference_raw_value double precision,
  primary key (model_run_id, scenario_id, candidate_id, feature_key)
);

create table if not exists location_evidence (
  model_run_id text not null references model_runs(id),
  location_id text not null references candidates(id),
  operational_hypothesis text not null,
  limitations jsonb not null,
  source_dataset_ids jsonb not null,
  primary key (model_run_id, location_id)
);

alter table datasets enable row level security;
alter table model_runs enable row level security;
alter table ranking_contributions enable row level security;
alter table location_evidence enable row level security;

drop policy if exists "public read datasets" on datasets;
drop policy if exists "public read model runs" on model_runs;
drop policy if exists "public read ranking contributions" on ranking_contributions;
drop policy if exists "public read location evidence" on location_evidence;
create policy "public read datasets" on datasets for select to anon using (true);
create policy "public read model runs" on model_runs for select to anon using (true);
create policy "public read ranking contributions" on ranking_contributions for select to anon using (true);
create policy "public read location evidence" on location_evidence for select to anon using (true);
