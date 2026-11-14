-- Terra Analog Mission Control: development fixture
-- ALL feature values and scores are synthetic, not measured.
-- Real place names are illustrative; coordinates are intentionally NULL.
-- Fixture scores are NOT probabilities or validated analog assessments.
-- Safe to rerun: existing rows with the same IDs are left unchanged.

begin;

insert into public.scenarios (id, name, body, description, data_mode)
values (
  'mars-reference-fixture-v1',
  'Mars reference area (fixture)',
  'Mars',
  'Synthetic development reference, not a real Mars study area. Reference features: slope 10 deg, roughness 20 m, relief 100 m. Demo normalization scales: 20 deg, 40 m, 200 m. Weights: 0.35, 0.35, 0.30. Not a landing-site recommendation; gravity, atmosphere and radiation are not modeled.',
  'fixture'
)
on conflict (id) do nothing;

insert into public.candidates
  (id, name, country, latitude, longitude, source)
values
  (
    'earth-atacama-fixture-v1',
    'Atacama Desert (fixture)',
    'Chile',
    null,
    null,
    'Synthetic development fixture. Place name is illustrative; features are not measured and coordinates are not supplied.'
  ),
  (
    'earth-iceland-fixture-v1',
    'Iceland volcanic terrain (fixture)',
    'Iceland',
    null,
    null,
    'Synthetic development fixture. Place name is illustrative; features are not measured and coordinates are not supplied.'
  ),
  (
    'earth-devon-fixture-v1',
    'Devon Island (fixture)',
    'Canada',
    null,
    null,
    'Synthetic development fixture. Place name is illustrative; features are not measured and coordinates are not supplied.'
  ),
  (
    'earth-mojave-fixture-v1',
    'Mojave Desert (fixture)',
    'United States',
    null,
    null,
    'Synthetic development fixture. Place name is illustrative; features are not measured and coordinates are not supplied.'
  ),
  (
    'earth-rio-tinto-fixture-v1',
    'Rio Tinto area (fixture)',
    'Spain',
    null,
    null,
    'Synthetic development fixture. Place name is illustrative; features are not measured and coordinates are not supplied.'
  )
on conflict (id) do nothing;

-- Demo formula:
-- similarity = 1 - weighted sum of capped normalized differences.
-- Each difference is abs(candidate - reference) / fixed scale.
-- Reference: slope=10, roughness=20, relief=100.
-- Scales: slope=20, roughness=40, relief=200.
-- These arbitrary fixture scales are NOT scientifically calibrated.

with fixture_features (
  candidate_id, slope_deg, roughness_m, relief_m
) as (
  values
    ('earth-atacama-fixture-v1', 12.0, 24.0, 120.0),
    ('earth-iceland-fixture-v1', 16.0, 32.0, 160.0),
    ('earth-devon-fixture-v1', 14.0, 28.0, 140.0),
    ('earth-mojave-fixture-v1', 18.0, 36.0, 180.0),
    ('earth-rio-tinto-fixture-v1', 20.0, 40.0, 200.0)
)
insert into public.candidate_scores (
  model_run_id,
  model_version,
  scenario_id,
  candidate_id,
  median_slope_deg,
  terrain_roughness_m,
  relative_relief_m,
  similarity_score,
  generated_at
)
select
  'fixture-run-v1',
  'fixture-demo-v1',
  'mars-reference-fixture-v1',
  candidate_id,
  slope_deg,
  roughness_m,
  relief_m,
  round(
    1.0
    - 0.35 * least(abs(slope_deg - 10.0) / 20.0, 1.0)
    - 0.35 * least(abs(roughness_m - 20.0) / 40.0, 1.0)
    - 0.30 * least(abs(relief_m - 100.0) / 200.0, 1.0),
    4
  ),
  now()
from fixture_features
on conflict (model_run_id, scenario_id, candidate_id) do nothing;

commit;