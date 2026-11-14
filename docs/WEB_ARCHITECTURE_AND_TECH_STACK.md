# Web Structure & Tech Stack Guide — Terra Analog Mission Control

**Scope:** Mars-first MVP, deployed on Vercel.  
**Architecture choice:** static-first backend-for-frontend. Python/data work happens offline; production web requests read only finalized, versioned artifacts.

## 1. Technology decisions

| Layer | Choice | Reason |
|---|---|---|
| App | Next.js 15+ App Router, TypeScript | Vercel-native deployment, server rendering, typed Route Handlers. |
| UI | Tailwind CSS, Radix primitives, Lucide icons | Fast responsive implementation and accessible controls. |
| Map | MapLibre GL JS + `react-map-gl/maplibre` | Interactive 2D vector map without mandatory proprietary map dependency. |
| Charts | Recharts | Small, accessible-enough contribution/profile charts. |
| Validation | Zod | Validates request parameters and database/API payloads. |
| Database | Supabase PostgreSQL | Managed Postgres, simple Vercel integration, REST/client options. |
| Geospatial database | PostGIS extension, post-MVP query path | Future spatial queries; MVP reads curated geometries and does not depend on runtime raster analysis. |
| Object/static data | Vercel public assets or Supabase Storage | Versioned GeoJSON/thumbnail/layer assets. |
| Data pipeline | Python 3.11+, pandas, geopandas, rasterio, scikit-learn | Reproducible offline preparation; no Python production runtime. |
| Testing | Vitest, React Testing Library, Playwright | Unit, component, and scripted browser checks. |

## 2. System architecture

```text
Browser
  └─ Next.js pages/components
       ├─ MapLibre renders versioned static vector/raster assets
       └─ calls same-origin Route Handlers
            └─ Supabase PostgreSQL (catalog, profiles, rankings, provenance)

Offline pipeline (not deployed as a web service)
  └─ raw sources → derived features → fitted transforms/model manifest
     → rankings + GeoJSON/assets → Supabase seed/import
```

The client never receives credentials, raw high-volume rasters, or an unversioned score. A route handler reads a finalized `model_run_id`; the response includes it so the UI can display which evidence generated a result.

## 3. Information architecture and routes

| Route | Purpose |
|---|---|
| `/` | Mission Control landing page: purpose, challenge alignment, scientific boundary, featured Mars scenario. |
| `/explore` | Interactive map and selection workspace. Query parameters may contain `scenario`, `candidate`, and `layers`. |
| `/compare/[scenarioId]/[candidateId]` | Shareable Earth–Mars comparison report. |
| `/methodology` | Formula, normalization, data limitations, source registry, and model versions. |
| `/api/scenarios` | Scenario catalog. |
| `/api/scenarios/[id]` | One Mars scenario with layer availability and profile. |
| `/api/scenarios/[id]/rankings` | Default or bounded-weight rankings. |
| `/api/candidates/[id]` | Candidate detail, feature profile, citations, and limitations. |
| `/api/compare` | Scenario/candidate comparison response. |

## 4. Proposed file structure

```text
nasa-space/
├─ app/
│  ├─ (marketing)/page.tsx
│  ├─ explore/page.tsx
│  ├─ compare/[scenarioId]/[candidateId]/page.tsx
│  ├─ methodology/page.tsx
│  ├─ api/
│  │  ├─ scenarios/route.ts
│  │  ├─ scenarios/[scenarioId]/route.ts
│  │  ├─ scenarios/[scenarioId]/rankings/route.ts
│  │  ├─ candidates/[candidateId]/route.ts
│  │  └─ compare/route.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ providers.tsx
├─ components/
│  ├─ mission-control/hero.tsx
│  ├─ mission-control/scenario-card.tsx
│  ├─ explorer/explorer-shell.tsx
│  ├─ explorer/planet-map.tsx
│  ├─ explorer/layer-control.tsx
│  ├─ explorer/location-inspector.tsx
│  ├─ explorer/ranking-dashboard.tsx
│  ├─ comparison/profile-comparison.tsx
│  ├─ comparison/contribution-chart.tsx
│  ├─ science/provenance-card.tsx
│  ├─ science/limitations-card.tsx
│  └─ ui/…
├─ lib/
│  ├─ api/response.ts
│  ├─ db/server.ts
│  ├─ db/queries.ts
│  ├─ domain/schemas.ts
│  ├─ domain/similarity.ts
│  ├─ domain/interpretation.ts
│  ├─ map/layers.ts
│  └─ utils.ts
├─ public/
│  ├─ data/manifest.json
│  ├─ layers/<model-run-id>/…
│  └─ images/…
├─ supabase/
│  ├─ migrations/0001_initial_schema.sql
│  ├─ seed.sql
│  └─ config.toml
├─ scripts/
│  ├─ import-model-run.ts
│  └─ verify-demo-data.ts
├─ tests/
│  ├─ unit/similarity.test.ts
│  ├─ unit/schemas.test.ts
│  ├─ component/layer-control.test.tsx
│  └─ e2e/explorer.spec.ts
├─ docs/
│  ├─ PRD.md
│  ├─ WEB_ARCHITECTURE_AND_TECH_STACK.md
│  └─ AI_DATA_PIPELINE_AND_IMPLEMENTATION.md
├─ .env.example
├─ next.config.ts
├─ package.json
└─ vercel.json
```

## 5. Database design

### Core tables

| Table | Purpose | Important columns |
|---|---|---|
| `celestial_bodies` | Extensible Earth/Mars/Moon registry | `id`, `slug`, `display_name`, `coordinate_reference_note` |
| `datasets` | Immutable provenance record | `id`, `name`, `provider`, `product_version`, `license`, `citation`, `url`, `native_resolution`, `retrieved_at` |
| `model_runs` | Reproducible finalized model output | `id`, `version`, `algorithm`, `feature_schema`, `weight_schema`, `artifact_uri`, `git_sha`, `created_at`, `status` |
| `locations` | Mars reference zones and Earth candidates | `id`, `body_id`, `kind`, `name`, `latitude`, `longitude`, `geometry`, `summary`, `operations_hypothesis` |
| `location_features` | Raw and transformed feature values | `location_id`, `model_run_id`, `feature_key`, `raw_value`, `raw_unit`, `normalized_value`, `transform`, `data_quality`, `dataset_id` |
| `rankings` | A candidate score for a scenario/model/weight set | `id`, `model_run_id`, `scenario_location_id`, `candidate_location_id`, `score`, `distance`, `data_coverage`, `rank`, `weight_schema` |
| `ranking_contributions` | Explainable score decomposition | `ranking_id`, `feature_key`, `weight`, `feature_distance`, `weighted_distance`, `status` |
| `location_evidence` | Human-readable cited validation/limitation | `id`, `location_id`, `type`, `claim`, `citation`, `url` |

### Constraints and indexes

- Unique `datasets(name, product_version)`.
- Unique `location_features(location_id, model_run_id, feature_key)`.
- Unique `rankings(model_run_id, scenario_location_id, candidate_location_id, weight_schema_hash)`.
- Check `locations.kind IN ('mars_reference', 'earth_candidate')` for MVP; schema permits Moon later via `body_id`.
- Check `score BETWEEN 0 AND 100`, `data_coverage BETWEEN 0 AND 1`.
- Index `rankings(model_run_id, scenario_location_id, rank)` and `locations(body_id, kind)`.
- PostGIS geometry index only when spatial search is introduced; do not make the MVP depend on it.

## 6. API contract

All endpoints return `{ data, meta }`; errors use `{ error: { code, message, requestId } }`. Every score response includes `meta.modelRunId`, `meta.modelVersion`, and `meta.generatedAt`.

### `GET /api/scenarios/{scenarioId}/rankings`

Query: `weights=slope:0.35,roughness:0.35,relative_relief:0.30` is optional. The handler rejects unknown features, invalid numbers, values outside 0.15–0.50, or fewer than three features. For the MVP it recomputes a small ranking deterministically from stored profiles; it never fits or changes a model.

```json
{
  "data": {
    "scenario": { "id": "mars-jezero-demo", "name": "Jezero terrain scenario" },
    "rankings": [{
      "rank": 1,
      "candidate": { "id": "earth-candidate-01", "name": "Curated Earth candidate" },
      "score": 82.4,
      "dataCoverage": 1,
      "contributions": [{ "featureKey": "slope", "weight": 0.35, "weightedDistance": 0.04 }],
      "interpretation": "Strong terrain-profile match; environmental conditions are not modeled."
    }]
  },
  "meta": { "modelRunId": "2026-11-14-mvp-v1", "modelVersion": "1.0.0" }
}
```

### `GET /api/compare?scenarioId=…&candidateId=…`

Returns raw values, normalized values, per-feature match labels, no-data flags, evidence, and mandatory limitations. This is the source for the shareable comparison page.

## 7. Frontend behavior

### Explorer layout

- Left rail: scenario selector and layer controls.
- Center: map with visual focus and keyboard-reachable controls.
- Right rail: selected location inspector; on narrow screens this becomes a bottom sheet.
- Bottom/secondary panel: ranking list and contribution visualization.
- Comparison opens as a dedicated route so it can be shared and reviewed.

### Map rules

- Use a configured, attributable basemap only if its terms allow the MVP deployment; keep an asset-backed fallback.
- Render points/polygons from processed GeoJSON, not raw scientific rasters.
- Layer legends state display units and source resolution.
- Map click must not silently select a point beneath another overlay; show selection affordance and a clear selected state.

## 8. Security and reliability baseline

- Store `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only for public read paths with Row Level Security enabled; never expose service-role keys.
- Use server-side `SUPABASE_SERVICE_ROLE_KEY` only for controlled import scripts/Route Handlers and never send it to the browser.
- MVP data is public read-only; no anonymous writes and no user uploads.
- Validate all route parameters with Zod; use allow-listed scenario/candidate IDs.
- Add rate limiting only if public traffic warrants it; use caching first for static catalog reads.
- Set Vercel environment variables separately for Preview and Production.
- Provide a static fallback message when Supabase is unavailable.

## 9. Environment configuration

```bash
NEXT_PUBLIC_APP_URL=https://<project>.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
DATA_MANIFEST_VERSION=2026-11-14-mvp-v1
```

`SUPABASE_SERVICE_ROLE_KEY` is not required by browser code and must never appear in a `NEXT_PUBLIC_` variable, client component, commit, screenshot, or demo recording.

## 10. Deployment guide

1. Create a Vercel project from the future Git repository and set framework preset to Next.js.
2. Create a Supabase project; enable PostGIS only if available, run migrations, and apply seed/import generated by the data pipeline.
3. Set environment variables in Vercel Preview and Production scopes.
4. Deploy a preview; confirm `/`, `/explore`, a ranking request, and a comparison URL.
5. Promote to Production only after source/citation, mobile layout, and demo-script checks pass.
6. Use the supplied Vercel URL as the challenge submission link; keep dataset assets below practical bundle/network limits.

## 11. Testing and release gates

| Layer | Required check |
|---|---|
| Domain | Same input profiles/weights produce the same score, ordering, coverage, and contributions. |
| API | Invalid IDs/weights return 400/404 without leaking database details. |
| Component | Layer toggle changes visible map source state and retains accessible label. |
| E2E | Select scenario → inspect → rank → open comparison → observe limitations and provenance. |
| Data | Every displayed feature joins to a dataset; every ranking has three required contributions. |
| Manual | Desktop and mobile pass; keyboard controls usable; Vercel production URL verified. |

## 12. Implementation sequence

1. Scaffold Next.js app, types, environment template, and test runner.
2. Create database schema and insert a minimal model run, one scenario, and five candidates.
3. Implement typed query layer and static API routes; write score determinism tests first.
4. Build landing page and explorer shell around fixture data.
5. Add MapLibre layers, inspector, ranking dashboard, and comparison route.
6. Import finalized data artifacts and replace fixtures only after schema validation passes.
7. Add provenance/limitations UI, end-to-end test, deploy, and rehearse.
