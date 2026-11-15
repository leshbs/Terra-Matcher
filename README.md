# Terra Analog Mission Control

**Mission rehearsal starts on Earth.**

Terra Analog Mission Control turns a bounded Mars terrain question into inspectable Earth candidate hypotheses. It compares a 20 km Gale Crater / Aeolis Palus reference window with five curated Earth windows using three reproducible terrain features: median slope, terrain roughness, and relative relief.

The result is a transparent score, not a verdict: **data-derived similarity, not mission-site approval.**

## Why it matters

Earth analogs can help teams frame testable questions about rover traversal, instruments, and geologic processes before field validation. This MVP makes the reasoning visible: every production ranking carries feature contributions, input dataset IDs, an operational hypothesis, and candidate-specific limitations.

## What is implemented

- A Mars-first candidate-ranking dashboard with fixture and production modes.
- Evidence-gated production results: incomplete provenance, contributions, or limitations cause the API to withhold the ranking.
- A methodology and provenance page at `/methodology`.
- A source-backed offline feature and ranking pipeline with reproducibility checks.
- Scientific-copy guardrails that reject unsupported claims in public-facing UI code.

## Scientific boundary

This is a terrain-feature comparison only. It does not model gravity, atmosphere or pressure/composition, radiation, temperature regimes, biological activity, access, safety, regulation, land permissions, rover safety, or mission suitability. An Earth candidate is a hypothesis for further review, not a proven analog or a recommended landing or field site.

## Data and method

The production model run is `2026-11-14-mvp-v1`:

- Mars: MOLA MEGDR gridded topography, NASA PDS.
- Earth: NASADEM HGT V001, NASA EOSDIS.
- Analysis resolution: 500 m; local terrain window: 3 km.
- Transform: `ecdf-midrank-v1`, fit separately to declared Earth and Mars study populations.
- Default feature weights: slope 0.35, roughness 0.35, relative relief 0.30.

Dataset citations, access URLs, units, resolutions, and product limitations are registered in `data/training/datasets.json` and shown in the application’s methodology endpoint.

## Local setup

Install dependencies and configure public Supabase values:

```powershell
npm ci
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'your-anon-key'
```

Apply the Supabase schema migrations in their existing numeric order, then seed fixtures and the production package:

```powershell
node scripts/build-production-seed.mjs --training-root data/training --output supabase/seed/0003_production_seed.sql
```

Run the app:

```powershell
npm run dev
```

## Verification

```powershell
npm run lint
npm run validate:production-evidence
npm run validate:scientific-claims
node --test pipeline/tests/*.mjs
node --experimental-strip-types --test tests/unit/terrain-evidence.test.mjs
```

For source-backed pipeline verification, use the configured Python runtime described in `data/training/README.md`.

## 90-second demo arc

1. Begin with the question: *Which curated Earth landscapes can help us study a defined Martian terrain question?*
2. Select the Gale / Aeolis Palus scenario and show the ranked candidates.
3. Open the highest-ranked candidate and explain the three terrain features and contribution breakdown.
4. Read the operational hypothesis, then the candidate limitation.
5. Open `/methodology` to show model run, dataset provenance, and scientific boundary.
6. Close on the impact: the output is an auditable starting point for Earth-based exploration questions, pending field and science review.

## NASA Space Apps submission description

Terra Analog Mission Control is an explainable Earth–Mars terrain comparison tool. It uses source-backed MOLA and NASADEM terrain data to compare a defined Gale Crater / Aeolis Palus reference window with five curated Earth candidates. Instead of presenting a black-box “best site,” it exposes the slope, roughness, and relief contributions behind each data-derived similarity score, along with source IDs, operational hypotheses, and limitations. The project helps students, science communicators, and future exploration researchers turn open planetary data into testable Earth-based questions while clearly showing what the comparison does not establish.

## License and data use

The application code is supplied under the repository’s applicable license. Follow the registered provider terms, citations, and access guidance for MOLA and NASADEM data. Raw data and generated local run artifacts are intentionally ignored by Git; they are not public web assets.
