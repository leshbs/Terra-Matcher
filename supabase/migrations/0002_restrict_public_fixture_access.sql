-- Restrict the existing anon SELECT policies to the supported fixture.
-- Mirrors the manual live RLS restriction verified on 2026-11-15.
-- Does not import, delete, activate, or approve publication of pipeline data.
--
-- Preconditions:
-- RLS is enabled on all three tables.
-- The named policies already exist as SELECT policies for anon.
-- No other applicable SELECT policy grants broader access.
--
-- Keep this migration after 0001_init.sql.
-- Re-running 0001 alone would restore unrestricted public SELECT policies.
-- Other grants, roles, views, and RPCs are outside this migration's scope.

begin;

alter policy "public read scenarios"
on public.scenarios
using (
  id = 'mars-reference-fixture-v1'
  and data_mode = 'fixture'
);

alter policy "public read scores"
on public.candidate_scores
using (
  scenario_id = 'mars-reference-fixture-v1'
  and model_run_id = 'fixture-run-v1'
  and model_version = 'fixture-demo-v1'
  and exists (
    select 1
    from public.scenarios s
    where s.id = candidate_scores.scenario_id
      and s.data_mode = 'fixture'
  )
);

alter policy "public read candidates"
on public.candidates
using (
  exists (
    select 1
    from public.candidate_scores cs
    where cs.candidate_id = candidates.id
      and cs.scenario_id = 'mars-reference-fixture-v1'
      and cs.model_run_id = 'fixture-run-v1'
      and cs.model_version = 'fixture-demo-v1'
  )
);

commit;