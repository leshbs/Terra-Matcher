# Comparison and Ranking Main-Web Integration Design

## Goal

Make the comparison and ranking experience a production-backed, single data flow in the main Terra Analog Mission Control web application. The public home page, ranking dashboard, and candidate comparison report must display the same scenario, candidates, scores, evidence, and scientific boundary.

## Current State

The application currently has two separate experiences:

- The home page uses `components/comparison-dashboard.tsx`. It fetches `/api/scenarios` and `/api/scenarios/[scenarioId]/candidates` and renders an earlier candidate view.
- `/compare` and `/compare/[scenarioId]/[candidateId]` use the newer Anggota 4 UI. Its adapter validates `ComparisonDataset`, but defaults to `data/fixtures/comparison-demo.json`. Its production switch expects `/api/scenarios/[scenarioId]/rankings` or `/api/compare`, neither of which exists.

This design makes the scenario-ranking endpoint the only production contract and eliminates the disconnected user-facing paths.

## Scope

### Included

- A typed production endpoint at `GET /api/scenarios/[scenarioId]/rankings`.
- Server-side assembly of a complete `ComparisonDataset` from Supabase scenario, ranking, contribution, evidence, model, and dataset-provenance records.
- Runtime validation of database records and response payloads.
- Migration of `/`, `/compare`, and `/compare/[scenarioId]/[candidateId]` to the same dataset loader and contract.
- Explicit, opt-in local demo mode using `comparison-demo.json`.
- Contract, route, component integration, and production-build tests.
- An incremental deprecation path for `/api/scenarios/[scenarioId]/candidates` and the legacy home-page dashboard.

### Excluded

- New ranking mathematics, model training, raster processing, or NASA downloads.
- Schema redesign unrelated to the fields needed by the established comparison contract.
- Authentication, user-saved comparisons, or dynamic user-defined ranking weights.
- Automatic fixture fallback in production mode.

## Canonical Data Contract

`ComparisonDataset` in `components/comparison/contracts.ts` is the canonical UI contract. The new endpoint returns either the dataset directly or `{ data: ComparisonDataset }`; the project will standardize on the envelope so future response metadata can be added without changing the UI.

The successful payload must include:

- one Mars reference scenario with coordinates, radius, feature values, source dataset IDs, and summary;
- five or more ranked Earth candidates with raw and normalized feature values, score, rank, coverage, profile status, feature contributions, operational hypothesis, limitations, and dataset references;
- feature definitions and declared model weights/version/run ID;
- enough dataset metadata for source badges and evidence links;
- the exact disclaimer: `data-derived similarity, not mission-site approval`.

The endpoint must order candidates by ascending `rank` and reject records that are inconsistent, incomplete, or outside the existing Zod constraints. A production response must never mix a fixture model run with production records.

## Data Flow

```text
Supabase: scenarios, candidate_scores, ranking_contributions,
location_evidence, datasets/model metadata
  -> server-only comparison repository/assembler
  -> GET /api/scenarios/[scenarioId]/rankings
  -> loadComparisonBundle({ scenarioId })
  -> Home ranking summary, /compare, and /compare/[scenarioId]/[candidateId]
```

The assembler is server-only and is the sole module that translates database naming and joins into `ComparisonDataset`. Pages and client components do not query Supabase or transform database rows.

## Source Modes and Failure Behavior

`COMPARISON_DATA_SOURCE` remains the mode selector:

- `api`: required in deployed production. The loader requests the ranking endpoint using `COMPARISON_API_ORIGIN` or the application origin. Request, HTTP, JSON, or schema failures render a clear unavailable/error state with no fixture data substituted.
- `fixture`: permitted only for local demo/development. It reads the bundled fixture and visibly labels the result as demo data.

Deployment configuration must set `COMPARISON_DATA_SOURCE=api` and an origin suitable for server-side fetches. The app must not silently select fixture mode because an environment variable is absent in a deployed environment.

## UI Integration

- `/` becomes a server-rendered mission-control landing page that loads the canonical bundle and renders a concise ranking summary. It links to `/compare` and the top candidate detail report.
- `/compare` remains the full ranking workspace with filters and explainability, but receives the canonical bundle.
- `/compare/[scenarioId]/[candidateId]` remains the shareable detail workspace and loads the same scenario-specific bundle.
- The legacy `ComparisonDashboard` is removed from the public route once the new home summary is in place. Its route-specific API contracts are not reused by new UI.
- Existing scientific disclaimer, source indicator, fixture badge, incomplete-profile warnings, and provenance/evidence sections remain mandatory.

## Compatibility and Rollout

1. Add and test the new endpoint and data assembler without changing public pages.
2. Point Anggota 4 pages at API mode in a local integration environment and validate successful and failed responses.
3. Replace the home-page legacy dashboard with the canonical summary.
4. Leave `/api/scenarios/[scenarioId]/candidates` operational for one release as a compatibility route, clearly marked deprecated in code and documentation.
5. After no consumer uses it, remove the legacy dashboard and candidates endpoint in a separate cleanup change.

## Error Handling

- Unknown `scenarioId`: HTTP 404 with `{ error: { code: "SCENARIO_NOT_FOUND", message } }`.
- Database unavailability: HTTP 503 with `RANKINGS_UNAVAILABLE`.
- Missing provenance, evidence, contributions, or model metadata: HTTP 503 with `INVALID_PROVENANCE`; no partial ranking is shown as production truth.
- Contract validation failure: HTTP 503 with `INVALID_RANKING_DATA`.
- Pages show the existing source/failure notice and retry guidance rather than a demo fallback in API mode.

## Test Strategy and Acceptance Criteria

- Unit-test the database-row-to-contract assembler for a valid full ranking, a partial-profile candidate, rank ordering, and all rejection paths.
- Route-test successful envelopes plus 404, unavailable, invalid-provenance, and invalid-ranking-data responses.
- Test the adapter in both modes: fixture is visibly labeled, API accepts the envelope, and API failure does not load fixture.
- Render-test the home summary, ranking page, and candidate page against the same representative `ComparisonDataset`.
- Run the existing comparison fixture/filter tests, route tests, lint, TypeScript checking, and `npm run build`.
- Manually verify one deployed or local API-mode scenario: the same top candidate, score, model run, and disclaimer appear on `/`, `/compare`, and the candidate URL.

## Ownership Boundaries

- Anggota 1 owns Supabase access, the ranking endpoint, environment configuration, and deployment verification.
- Anggota 4 owns the comparison/ranking UI components and consumes only the canonical contract.
- The integration owner owns contract changes, migration sequencing, and acceptance verification across routes.

## Decisions Locked by This Design

- The new ranking endpoint is the single production source for all public ranking/comparison views.
- `ComparisonDataset` is the frontend-backend boundary.
- Fixture data is explicit development/demo data, never a production failure fallback.
- The legacy candidates API is transitional only and will not receive new features.
