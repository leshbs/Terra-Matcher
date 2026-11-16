-- A production endpoint may only use an explicitly finalized model run.
alter table public.model_runs
  add column if not exists status text not null default 'draft'
  check (status in ('draft', 'ready', 'retired'));

update public.model_runs
set status = case
  when id = '2026-11-14-mvp-v1' then 'ready'
  else 'draft'
end
where status not in ('ready', 'retired');

drop policy if exists "public read approved model runs" on public.model_runs;
create policy "public read ready model runs"
  on public.model_runs
  for select
  to anon
  using (status = 'ready');
