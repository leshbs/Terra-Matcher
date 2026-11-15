# Migrations

These files record how the database schema was applied.
They were run **manually in the Supabase SQL Editor**, in filename order.

The Supabase CLI migration runner has never been used against this database:
the `supabase_migrations` schema does not exist (checked 2026-11-15).
Do not run `supabase db push` before agreeing on a history-reconciliation
plan — the runner would treat the database as empty and replay every file.

## Order

| # | File | What it does |
|---|---|---|
| 1 | `0001_init.sql` | Base schema and its initial public SELECT policies |
| 2 | `0002_production_provenance.sql` | Adds `datasets`, `model_runs`, `ranking_contributions`, `location_evidence`; opens public SELECT on all four |
| 3 | `0003_restrict_public_fixture_access.sql` | Restricts `scenarios`, `candidates`, `candidate_scores` to the fixture |
| 4 | `0004_restrict_public_provenance_access.sql` | Replaces the open dataset/model_run policies with "approved" ones; removes anon policies from `ranking_contributions` and `location_evidence` |

Order matters: step 2 opens public SELECT on `datasets` and `model_runs`,
and step 4 closes it again. Running them out of order leaves the database open.

## Numbering

`0003` and `0004` were previously numbered `0002` and `0003`.
Two files shared the version `0002`, which would have made the CLI runner
ambiguous. They were renumbered in a follow-up PR to match the order in which
they were actually applied. No database change was involved.

## Verified state (2026-11-15)

Read-only inspection of `pg_policies`:

- `scenarios`, `candidates`, `candidate_scores` — fixture-restricted
- `datasets`, `model_runs` — "approved" policies
- `ranking_contributions`, `location_evidence` — no anon policy

Table-level SELECT grants on the last two are still in place; RLS denies access.
Revoking them would be defence in depth and needs a separate decision.