# Explorer and Comparison Main-Web Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production Supabase-backed Explorer that uses the same ready scenario/model run, ranking, provenance, and landing-page flow as Comparison and Ranking.

**Architecture:** A server-only scenario repository selects and validates one production scenario/model run from Supabase. The new Rankings endpoint and Explorer endpoint use separate assemblers over that shared repository: Comparison emits `ComparisonDataset`; Explorer emits map windows plus grid samples. Browser components fetch only their matching Next.js endpoint and never query Supabase directly.

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, Zod 4, Supabase PostgreSQL/RLS, MapLibre GL, Node test runner, ESLint.

**Specs:** `docs/superpowers/specs/2026-11-15-explorer-production-integration-design.md`; `docs/superpowers/specs/2026-11-15-comparison-ranking-main-web-integration-design.md`

## Global Constraints

- Production requests read finalized data only; never download NASA data, train a model, or process raster data at request time.
- `candidate_scores` is the physical score table; “ranking” is the API/UI concept.
- Production routes reject unknown, fixture-mode, incomplete, or non-ready model runs; they never silently use fixture data.
- `COMPARISON_DATA_SOURCE=api` and `EXPLORER_DATA_SOURCE=api` are required in deployment; `fixture` is explicit local development only and visibly labelled.
- `SUPABASE_SERVICE_ROLE_KEY` remains server-only and is never imported by a client component or exposed in a `NEXT_PUBLIC_` variable.
- Every production view displays the scientific boundary: `data-derived similarity, not mission-site approval`.
- Use one Mars scenario and five Earth candidates for the MVP; require exactly 25 grid samples per location.

---

## File structure

- `lib/scenario-production.ts` — server-only query boundary, row schemas, and validated shared scenario context.
- `lib/comparison/assembler.ts` — pure mapper from the shared context to the `ComparisonDataset` contract.
- `lib/explore/contracts.ts` — Zod schema and TypeScript types for the Explorer API envelope.
- `lib/explore/assembler.ts` — pure mapper from shared context and grid samples to Explorer data.
- `supabase/migrations/0005_model_run_readiness.sql` — model-run readiness enum/check, default, backfill, and approved read-policy update.
- `supabase/migrations/0006_explorer_grid_samples.sql` — table, constraints, indexes, RLS, and read policy.
- `supabase/seed/0004_explorer_grid_samples.sql` — production grid-sample seed generated from the validated pipeline artifact.
- `scripts/build-explorer-grid-seed.mjs` — validates the six-by-25 import artifact and emits the seed SQL.
- `app/api/scenarios/[scenarioId]/rankings/route.ts` — canonical Comparison/Ranking endpoint using the shared repository.
- `app/api/scenarios/[scenarioId]/explorer/route.ts` — production Explorer endpoint using the shared repository and Explorer assembler.
- `lib/explore/data.ts` — mode-aware Explorer client loader.
- `components/explore/ExploreShell.tsx`, `MapView.tsx`, `Inspector.tsx` — loading/error/data-mode UI and React lint corrections.
- `app/page.tsx`, `components/mission-control/*` — server-rendered landing summary and visible `/explore` navigation, as defined by the Comparison spec.
- `tests/unit/scenario-production.test.mjs`, `comparison-assembler.test.mjs`, `comparison-loader.test.mjs`, `explorer-assembler.test.mjs`, `explorer-loader.test.mjs`, `tests/api/scenario-rankings.route.test.mjs`, `tests/api/scenario-explorer.route.test.mjs` — production contract and error-path tests.
- `tests/e2e/main-web-flow.spec.ts` — cross-page production smoke flow.

### Task 1: Establish the shared production scenario boundary

**Files:**
- Create: `lib/scenario-production.ts`
- Create: `tests/unit/scenario-production.test.mjs`
- Modify: `lib/terrain-evidence.ts`
- Create: `supabase/migrations/0005_model_run_readiness.sql`
- Modify: `supabase/seed/0003_production_seed.sql`
- Modify: `supabase/migrations/README.md`

**Interfaces:**
- Consumes: `supabaseServer`, `scenarioId: string`.
- Produces: `loadProductionScenario(scenarioId): Promise<ProductionScenarioContext>` where the context contains the validated scenario, ready model run, ordered `candidateScores`, contributions, evidence, datasets, and locations.

- [ ] **Step 1: Write failing tests for model-run and provenance gating.**

```js
test('rejects a fixture scenario in the production repository', async () => {
  await assert.rejects(() => loadProductionScenario('mars-reference-fixture-v1'), /fixture/i);
});

test('rejects a score row whose model run differs from the selected ready run', () => {
  assert.throws(() => validateProductionContext(inconsistentRows), /model run/i);
});
```

- [ ] **Step 2: Run the new test file and confirm failure.**

Run: `node --test tests/unit/scenario-production.test.mjs`

Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: Add migration `0005_model_run_readiness.sql` and update the production seed.** Add `status text not null default 'draft' check (status in ('draft', 'ready', 'retired'))` to `model_runs`, backfill existing rows to `draft` except `2026-11-14-mvp-v1` to `ready`, require the seed upsert to write `status = 'ready'`, and replace the anon model-run policy with one restricted to `status = 'ready'`. Update the migration README so `0005` precedes the grid-sample migration.

- [ ] **Step 4: Implement Zod row schemas and `validateProductionContext`.**

```ts
export function validateProductionContext(input: unknown): ProductionScenarioContext {
  const parsed = productionContextSchema.parse(input);
  if (parsed.scenario.data_mode !== "production") throw new Error("Fixture scenario is not production data.");
  if (parsed.modelRun.status !== "ready") throw new Error("Model run is not ready.");
  return parsed;
}
```

- [ ] **Step 5: Implement `loadProductionScenario` as the only Supabase join/query boundary.** Query `scenarios`, `model_runs`, `candidate_scores`, `ranking_contributions`, `location_evidence`, `datasets`, and locations; select exactly one `status = 'ready'` run; validate IDs, candidate rank order, required three contributions, evidence, and shared model-run ID before returning the context.

- [ ] **Step 6: Run repository and existing evidence tests.**

Run: `node --test tests/unit/scenario-production.test.mjs tests/unit/terrain-evidence.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add lib/scenario-production.ts lib/terrain-evidence.ts tests/unit/scenario-production.test.mjs supabase/migrations/0005_model_run_readiness.sql supabase/seed/0003_production_seed.sql supabase/migrations/README.md
git commit -m "feat: add validated production scenario repository"
```

### Task 2: Persist and validate map grid samples

**Files:**
- Create: `supabase/migrations/0006_explorer_grid_samples.sql`
- Create: `scripts/build-explorer-grid-seed.mjs`
- Create: `supabase/seed/0004_explorer_grid_samples.sql`
- Create: `tests/unit/explorer-grid-seed.test.mjs`
- Modify: `supabase/migrations/README.md`

**Interfaces:**
- Consumes: `pipeline/outputs/<model-run-id>/explorer-grid-samples.json` with `{ locationId, modelRunId, datasetId, offsetEastKm, offsetNorthKm, slope, roughness, relativeRelief, qualityFlag }`.
- Produces: exactly 150 valid rows (25 per 6 locations) in `explorer_grid_samples`.

- [ ] **Step 1: Write failing artifact-validation tests.**

```js
test('accepts six locations with 25 finite samples each', () => {
  assert.equal(validateExplorerGridSamples(validSamples).length, 150);
});

test('rejects a location with fewer than 25 samples', () => {
  assert.throws(() => validateExplorerGridSamples(validSamples.slice(0, 149)), /25 samples/i);
});
```

- [ ] **Step 2: Run the test and confirm failure.**

Run: `node --test tests/unit/explorer-grid-seed.test.mjs`

Expected: FAIL because the seed builder is absent.

- [ ] **Step 3: Write migration `0006_explorer_grid_samples.sql`.** Create the FK-constrained table with unique `(location_id, model_run_id, offset_east_km, offset_north_km)`, numeric checks for finite non-negative terrain measures, an index on `(model_run_id, location_id)`, RLS enabled, and a SELECT-only policy restricted to approved/ready production rows. Do not create INSERT, UPDATE, or DELETE policies for `anon`.

- [ ] **Step 4: Implement the deterministic seed builder and generate `0004_explorer_grid_samples.sql`.** It must reject duplicate offsets, unknown location/dataset/model-run IDs, non-production rows, bad units, and any count other than 25 per location before emitting idempotent inserts.

- [ ] **Step 5: Update the migration README with exact order.** Record `0006_explorer_grid_samples.sql` after `0005_model_run_readiness.sql` and `0004_explorer_grid_samples.sql` after the production seed.

- [ ] **Step 6: Run artifact tests.**

Run: `node --test tests/unit/explorer-grid-seed.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add supabase/migrations/0006_explorer_grid_samples.sql supabase/migrations/README.md scripts/build-explorer-grid-seed.mjs supabase/seed/0004_explorer_grid_samples.sql tests/unit/explorer-grid-seed.test.mjs
git commit -m "feat: add versioned Explorer grid samples"
```

### Task 3: Assemble canonical Comparison and Explorer contracts from one context

**Files:**
- Create: `lib/comparison/assembler.ts`
- Create: `lib/explore/contracts.ts`
- Create: `lib/explore/assembler.ts`
- Create: `tests/unit/comparison-assembler.test.mjs`
- Create: `tests/unit/explorer-assembler.test.mjs`
- Modify: `components/comparison/contracts.ts`
- Modify: `components/comparison/data.ts`

**Interfaces:**
- Consumes: `ProductionScenarioContext` and `ExplorerGridSample[]`.
- Produces: `assembleExplorerDataset(context, samples): ExplorerDataset`, with `{ data: { datasets, windows }, meta: { modelRunId, modelVersion, dataMode: "production" } }`.
- Produces: `assembleComparisonDataset(context): ComparisonDataset` and `assembleExplorerDataset(context, samples): ExplorerDataset`, both from the same `ProductionScenarioContext` without another database mapper.

- [ ] **Step 1: Write failing pure-assembler tests.**

```js
test('Comparison preserves the ready model run, rank order, and evidence', () => {
  const comparison = assembleComparisonDataset(context);
  assert.equal(comparison.model.modelRunId, context.modelRun.id);
  assert.deepEqual(comparison.candidates.map((item) => item.rank), [1, 2, 3, 4, 5]);
  assert.equal(comparison.candidates[0].evidence.operationalHypothesis, context.evidenceByLocation[comparison.candidates[0].id].operationalHypothesis);
});

test('Comparison rejects missing contributions or a fixture model run', () => {
  assert.throws(() => assembleComparisonDataset(incompleteContributionContext), /contribution/i);
  assert.throws(() => assembleComparisonDataset(fixtureRunContext), /production/i);
});

test('keeps the top candidate and model run identical to Comparison context', () => {
  const explorer = assembleExplorerDataset(context, samples);
  assert.equal(explorer.meta.modelRunId, context.modelRun.id);
  assert.equal(explorer.data.windows.find((window) => window.rank === 1)?.id, context.candidateScores[0].candidateId);
});

test('rejects mixed-run and incomplete sample sets', () => {
  assert.throws(() => assembleExplorerDataset(context, mixedRunSamples), /model run/i);
  assert.throws(() => assembleExplorerDataset(context, samples.slice(1)), /25 samples/i);
});
```

- [ ] **Step 2: Run the test and confirm failure.**

Run: `node --test tests/unit/comparison-assembler.test.mjs tests/unit/explorer-assembler.test.mjs`

Expected: FAIL because the assembler does not exist.

- [ ] **Step 3: Implement `assembleComparisonDataset` in `lib/comparison/assembler.ts`.** Map the validated Mars reference, candidate scores, contributions, evidence, datasets, and model metadata into `ComparisonDataset`; preserve ascending rank order; validate the completed object with `comparisonDatasetSchema`; reject missing required contribution, evidence, provenance, or production model-run fields.

- [ ] **Step 4: Define `ExplorerDatasetSchema` and strict sample schema in `lib/explore/contracts.ts`.** Preserve all fields required by `MapView` and `Inspector`: coordinates, rank, score, coverage, dataset, hypothesis, limitations, contributions, three aggregate features, and 25 points.

- [ ] **Step 5: Implement `assembleExplorerDataset`.** Group samples by location, map the existing physical `candidate_scores` rows to ranked Earth windows, map the Mars reference to a non-ranked window, and sort by `rank`; validate the completed object with `ExplorerDatasetSchema` before returning it.

- [ ] **Step 6: Refactor Comparison’s data adapter to receive only the canonical endpoint envelope.** Keep `ComparisonDataset` as its UI boundary; do not let pages, client components, or the adapter transform Supabase rows.

- [ ] **Step 7: Run contract tests.**

Run: `node --test tests/unit/comparison-assembler.test.mjs tests/unit/explorer-assembler.test.mjs tests/unit/comparison-adapter.test.mjs tests/unit/comparison-fixture.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add lib/comparison/assembler.ts lib/explore/contracts.ts lib/explore/assembler.ts components/comparison/contracts.ts components/comparison/data.ts tests/unit/comparison-assembler.test.mjs tests/unit/explorer-assembler.test.mjs
git commit -m "feat: share production scenario contracts across map and ranking"
```

### Task 4: Expose aligned production API routes

**Files:**
- Create: `app/api/scenarios/[scenarioId]/rankings/route.ts`
- Create: `app/api/scenarios/[scenarioId]/explorer/route.ts`
- Create: `tests/api/scenario-rankings.route.test.mjs`
- Create: `tests/api/scenario-explorer.route.test.mjs`
- Modify: `app/api/scenarios/[scenarioId]/candidates/route.ts`

**Interfaces:**
- Consumes: `scenarioId` path parameter validated as `[A-Za-z0-9_-]{1,128}`.
- Produces: `{ data: ComparisonDataset, meta }` at `rankings` and `{ data: ExplorerData, meta }` at `explorer`.
- Errors: `SCENARIO_NOT_FOUND` (404), `RANKINGS_UNAVAILABLE` or `EXPLORER_UNAVAILABLE` (503), `INVALID_PROVENANCE`, `INVALID_RANKING_DATA`, or `INVALID_EXPLORER_DATA` (503).

- [ ] **Step 1: Write failing route tests with mocked repository results.**

```js
test('Rankings returns a validated production ComparisonDataset envelope', async () => {
  const response = await GET(new Request('http://test/api/scenarios/mars-gale-aeolis-palus-v1/rankings'), routeContext);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.dataMode, 'production');
  assert.equal(payload.data.candidates[0].rank, 1);
  assert.equal(payload.data.disclaimer, 'data-derived similarity, not mission-site approval');
});

test('Rankings rejects incomplete provenance instead of emitting a partial result', async () => {
  mockLoadProductionScenario.mockRejectedValueOnce(new InvalidProvenanceError('missing evidence'));
  const response = await GET(new Request('http://test/api/scenarios/mars-gale-aeolis-palus-v1/rankings'), routeContext);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'INVALID_PROVENANCE');
});

test('Explorer returns a production envelope for a ready scenario', async () => {
  const response = await GET(new Request('http://test/api/scenarios/mars-gale-aeolis-palus-v1/explorer'), routeContext);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meta.dataMode, 'production');
});

test('Explorer returns 404 for an unknown scenario without fixture fallback', async () => {
  const response = await GET(new Request('http://test/api/scenarios/missing/explorer'), missingContext);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'SCENARIO_NOT_FOUND');
});
```

- [ ] **Step 2: Run both API suites and confirm failure.**

Run: `node --test tests/api/scenario-rankings.route.test.mjs tests/api/scenario-explorer.route.test.mjs`

Expected: FAIL because both new routes are absent.

- [ ] **Step 3: Implement the Rankings route over `loadProductionScenario` and `assembleComparisonDataset`.** Return `{ data: ComparisonDataset, meta: { dataMode: "production", modelRunId, modelVersion } }`; set `Cache-Control: no-store`; map repository validation failures to the documented error codes without returning raw Supabase errors.

- [ ] **Step 4: Implement the Explorer route over `loadProductionScenario` and `assembleExplorerDataset`.** Query only the scenario’s matching `explorer_grid_samples`; return `Cache-Control: no-store`; never put raw Supabase errors in JSON.

- [ ] **Step 5: Mark `candidates` as deprecated compatibility-only.** Keep its response unchanged for one release, add a code comment naming `/rankings` as the replacement, and do not add Explorer behavior to it.

- [ ] **Step 6: Run route suites.**

Run: `node --test tests/api/scenario-rankings.route.test.mjs tests/api/scenario-explorer.route.test.mjs`

Expected: PASS, including 404 and 503 cases.

- [ ] **Step 7: Commit.**

```bash
git add app/api/scenarios tests/api
git commit -m "feat: expose shared production ranking and Explorer APIs"
```

### Task 5: Connect Comparison UI to the canonical API contract

**Files:**
- Modify: `components/comparison/adapter.ts`
- Modify: `components/comparison/data.ts`
- Modify: `app/compare/page.tsx`
- Modify: `app/compare/[scenarioId]/[candidateId]/page.tsx`
- Create: `tests/unit/comparison-loader.test.mjs`
- Create: `tests/component/comparison-api-state.test.tsx`

**Interfaces:**
- Consumes: `loadComparisonBundle({ scenarioId?: string, strict?: boolean }): Promise<ComparisonBundle>` and the `{ data: ComparisonDataset, meta }` Rankings envelope.
- Produces: an explicit fixture banner in fixture mode; API-backed ranking and detail pages in API mode; a retryable unavailable state when the endpoint, envelope, or provenance is invalid.

- [ ] **Step 1: Write failing source-mode tests.**

```js
test('API mode requests the canonical scenario rankings endpoint', async () => {
  process.env.COMPARISON_DATA_SOURCE = 'api';
  await loadComparisonBundle({ scenarioId: 'mars-gale-aeolis-palus-v1', strict: true });
  assert.match(fetch.mock.calls[0][0], /\/api\/scenarios\/mars-gale-aeolis-palus-v1\/rankings$/);
});

test('API failure does not replace production data with the fixture', async () => {
  process.env.COMPARISON_DATA_SOURCE = 'api';
  await assert.rejects(
    () => loadComparisonBundle({ scenarioId: 'mars-gale-aeolis-palus-v1', strict: true }),
    /Comparison API/,
  );
});
```

- [ ] **Step 2: Run the test and confirm failure.**

Run: `node --test tests/unit/comparison-loader.test.mjs`

Expected: FAIL because API failure still falls back to the local fixture.

- [ ] **Step 3: Validate the `{ data: ComparisonDataset, meta }` envelope and make source mode explicit.** In `api` mode, fetch only `/api/scenarios/${scenarioId}/rankings`; in `fixture` mode, read the local fixture and set the fixture source label. In deployment, an absent or unknown source mode is a configuration failure, never implicit fixture data. Preserve the local fixture only for an explicit development/demo setting.

- [ ] **Step 4: Render the existing unavailable/error state in both Comparison pages.** Do not call `notFound()` for a transport, response-validation, or provenance failure; reserve it for a valid payload that lacks the requested scenario/candidate. Keep source badges, fixture notices, contribution warnings, and the scientific boundary.

- [ ] **Step 5: Run Comparison checks.**

Run: `node --test tests/unit/comparison-loader.test.mjs tests/unit/comparison-adapter.test.mjs tests/unit/comparison-fixture.test.mjs tests/unit/ranking-filters.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add components/comparison/adapter.ts components/comparison/data.ts app/compare tests/unit/comparison-loader.test.mjs tests/component/comparison-api-state.test.tsx
git commit -m "feat: load comparison views from canonical rankings API"
```

### Task 6: Connect Explorer UI without direct database access

**Files:**
- Modify: `lib/explore/data.ts`
- Modify: `lib/explore/types.ts`
- Modify: `components/explore/ExploreShell.tsx`
- Modify: `components/explore/MapView.tsx`
- Modify: `components/explore/Inspector.tsx`
- Create: `tests/unit/explorer-loader.test.mjs`
- Create: `tests/component/explore-shell.test.tsx`

**Interfaces:**
- Consumes: `loadExplore({ scenarioId: string }): Promise<ExplorerDataset>`.
- Produces: a loading state, production data-mode banner, retryable unavailable state, explicit no-sample state, and an interactive map only after a valid payload.

- [ ] **Step 1: Write failing loader-mode tests.**

```js
test('API mode requests the scenario Explorer endpoint', async () => {
  process.env.EXPLORER_DATA_SOURCE = 'api';
  await loadExplore({ scenarioId: 'mars-gale-aeolis-palus-v1' });
  assert.match(fetch.mock.calls[0][0], /\/api\/scenarios\/mars-gale-aeolis-palus-v1\/explorer$/);
});

test('API failure does not read the fixture', async () => {
  process.env.EXPLORER_DATA_SOURCE = 'api';
  await assert.rejects(() => loadExplore({ scenarioId: 'mars-gale-aeolis-palus-v1' }));
});
```

- [ ] **Step 2: Run loader tests and confirm failure.**

Run: `node --test tests/unit/explorer-loader.test.mjs`

Expected: FAIL because the loader reads only the fixture.

- [ ] **Step 3: Implement explicit loader modes and runtime envelope validation.** `api` fetches `/api/scenarios/${scenarioId}/explorer`; `fixture` reads the local fixture and sets `meta.dataMode: "fixture"`; any unrecognised mode throws a configuration error. Do not let an absent production variable default to fixture.

- [ ] **Step 4: Add shell states before mounting MapLibre.** Render labelled loading, unavailable-with-retry, fixture banner, and no-sample states. Retain existing Mars/Bumi, layer, opacity, zoom, selection, attribution, and limitation interactions for valid data.

- [ ] **Step 5: Correct lint-invalid ref writes.** Move `winRef.current = winId` and `pr.current = props` from render into effects or replace them with callback dependencies so `npm run lint` reports no React refs errors.

- [ ] **Step 6: Run UI-focused checks.**

Run: `node --test tests/unit/explorer-loader.test.mjs && npm run lint`

Expected: PASS with no errors; bundled MapLibre warnings may remain only if excluded by the project ESLint configuration.

- [ ] **Step 7: Commit.**

```bash
git add lib/explore components/explore tests/unit/explorer-loader.test.mjs tests/component/explore-shell.test.tsx
git commit -m "feat: load Explorer from production scenario API"
```

### Task 7: Integrate main-web navigation and cross-page verification

**Files:**
- Modify: `app/page.tsx`
- Create or modify: `components/mission-control/RankingSummary.tsx`
- Modify: `app/compare/page.tsx`
- Modify: `app/compare/[scenarioId]/[candidateId]/page.tsx`
- Modify: `.env.example`
- Create: `tests/e2e/main-web-flow.spec.ts`
- Modify: `docs/90_SECOND_DEMO_SCRIPT.md`

**Interfaces:**
- Consumes: the canonical Ranking loader for landing/Comparison and `loadExplore` for Explorer, all pinned to `mars-gale-aeolis-palus-v1`.
- Produces: links from `/` to `/compare`, top-candidate detail, and `/explore`; identical production scenario/model run/top candidate/score/disclaimer across the four public pages.

- [ ] **Step 1: Write a failing end-to-end flow.**

```ts
test('main web uses one production scenario across ranking and Explorer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /explore/i })).toBeVisible();
  await page.getByRole('link', { name: /explore/i }).click();
  await expect(page.getByText(/2026-11-14-mvp-v1/)).toBeVisible();
  await expect(page.getByText(/not a mission-site recommendation/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test and confirm failure.**

Run: `npx playwright test tests/e2e/main-web-flow.spec.ts`

Expected: FAIL because the landing page still mounts the legacy dashboard and has no Explorer link.

- [ ] **Step 3: Implement the landing summary defined by the Comparison specification.** Replace the public use of `ComparisonDashboard` with the canonical server-rendered summary, add accessible links to `/compare`, the top candidate detail path, and `/explore`, and leave the legacy candidates endpoint only for compatibility.

- [ ] **Step 4: Add deployment configuration and demo instructions.** Set documented production examples for `COMPARISON_DATA_SOURCE=api` and `EXPLORER_DATA_SOURCE=api`; never add real Supabase keys. Update the 90-second script to show `/` → `/explore` → `/compare` and state that all use the same model run.

- [ ] **Step 5: Run the complete release check.**

Run: `node --test tests/unit/*.test.mjs tests/api/*.test.mjs && npm run lint && npm run build && npx playwright test tests/e2e/main-web-flow.spec.ts`

Expected: PASS. Then apply migrations/seeds to the target Supabase project and repeat the four-page smoke flow on the deployed Vercel URL using production API mode.

- [ ] **Step 6: Commit.**

```bash
git add app components/mission-control .env.example tests/e2e/main-web-flow.spec.ts docs/90_SECOND_DEMO_SCRIPT.md
git commit -m "feat: link production Explorer into the main web flow"
```

## Final acceptance checklist

- [ ] Exactly one ready production model run is selected for the requested scenario.
- [ ] `/`, `/compare`, candidate detail, and `/explore` agree on model run, top candidate, score, and disclaimer.
- [ ] Explorer renders six windows with 25 source-backed grid samples each and never invents cells from aggregate features.
- [ ] Both production routes return structured errors and never use a fixture fallback.
- [ ] Browser code contains no service-role credential or direct Supabase access.
- [ ] Desktop and mobile MapLibre interaction, attribution, inspector provenance, and retry/error state work on the deployed application.
