-- Migrasi awal Terra Analog Mission Control
-- Aman dijalankan ulang (idempotent)

create table if not exists scenarios (
  id text primary key,
  name text not null,
  body text not null default 'Mars',
  description text,
  data_mode text not null check (data_mode in ('fixture', 'production')),
  created_at timestamptz not null default now()
);

create table if not exists candidates (
  id text primary key,
  name text not null,
  country text,
  latitude double precision,   -- derajat
  longitude double precision,  -- derajat
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists candidate_scores (
  model_run_id text not null,
  model_version text not null,
  scenario_id text not null references scenarios(id),
  candidate_id text not null references candidates(id),
  median_slope_deg double precision,        -- derajat
  terrain_roughness_m double precision,     -- meter
  relative_relief_m double precision,       -- meter
  similarity_score double precision,        -- 0 sampai 1, bukan probabilitas
  generated_at timestamptz not null,
  primary key (model_run_id, scenario_id, candidate_id)
);

-- MVP: data bersifat baca publik, penulisan hanya lewat service role
alter table scenarios enable row level security;
alter table candidates enable row level security;
alter table candidate_scores enable row level security;

drop policy if exists "public read scenarios" on scenarios;
create policy "public read scenarios" on scenarios for select to anon using (true);

drop policy if exists "public read candidates" on candidates;
create policy "public read candidates" on candidates for select to anon using (true);

drop policy if exists "public read scores" on candidate_scores;
create policy "public read scores" on candidate_scores for select to anon using (true);
