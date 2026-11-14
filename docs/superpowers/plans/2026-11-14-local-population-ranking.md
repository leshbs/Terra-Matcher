# Local-Population Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Produce explainable terrain-similarity rankings for the five Earth candidates relative to Gale Crater.

**Architecture:** Existing raster extraction supplies three-kilometre local study profiles. A pure Python module fits separate Mars and Earth ECDF transforms and computes weighted similarity. A runner exports deterministic JSON artifacts with provenance, evidence, and validation.

**Tech Stack:** Python standard library, NumPy, unittest, JSON, MOLA MEGDR and NASADEM readers.

**Spec:** docs/superpowers/specs/2026-11-14-local-population-ranking-design.md

## Global Constraints

- Keep downloads under data/training/raw and outputs under data/training/processed/2026-11-14-mvp-v1; both stay ignored.
- Preserve raw value, unit, source dataset ID, quality flag, 500 m resolution, and seven-by-seven neighbourhood provenance.
- Derive samples from the fixed -8, -4, 0, 4, 8 km east × north grid with three-kilometre windows.
- Fit ECDF mid-ranks separately by body and persist transform values in model_manifest.json.
- Use slope .35, roughness .35, and relief .30. Exclude only invalid features and renormalise remaining weights.
- Describe only terrain similarity, never mission-site approval.

---

## File Structure

- Create pipeline/src/terra_analog/ranking.py: pure ECDF and scoring functions.
- Create pipeline/src/terra_analog/run_rankings.py: sampling and JSON artifact writer.
- Create pipeline/tests/test_ranking.py and pipeline/tests/test_run_rankings.py.
- Modify pipeline/src/terra_analog/run_training_features.py for radius-aware extraction and location offsets.
- Modify pipeline/tests/test_terrain_features.py, data/training/README.md, and PEMBAGIAN-PERAN.md.

### Task 1: Implement normalisation and scoring

**Files:**
- Create: pipeline/src/terra_analog/ranking.py
- Create: pipeline/tests/test_ranking.py

**Interfaces:**
- fit_ecdf(values: Sequence[float]) -> tuple[float, ...]
- ecdf_midrank(value: float, sorted_values: Sequence[float]) -> float
- normalise_features(features, transforms) -> list[dict[str, object]]
- score_candidate(reference, candidate, weights) -> tuple[float, float, list[dict[str, object]]]

- [ ] **Step 1: Write failing ECDF tests**

~~~python
def test_ecdf_midrank_uses_declared_formula():
    assert ecdf_midrank(20.0, fit_ecdf([10.0, 20.0, 30.0, 40.0])) == 0.375

def test_transform_is_selected_by_body():
    feature = {"featureKey": "median_slope_deg", "rawValue": 2.0}
    result = normalise_features([feature], {"median_slope_deg": [1.0, 2.0, 3.0]})
    assert result[0]["normalizedValue"] == 0.5
~~~

- [ ] **Step 2: Run to verify failure**

Run: $env:PYTHONPATH='pipeline/src'; & 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest pipeline/tests/test_ranking.py -v

Expected: FAIL because terra_analog.ranking does not exist.

- [ ] **Step 3: Implement the minimal ECDF module**

~~~python
from bisect import bisect_right

def fit_ecdf(values):
    return tuple(sorted(float(value) for value in values))

def ecdf_midrank(value, sorted_values):
    if not sorted_values:
        raise ValueError("ECDF requires at least one value")
    return max(0.0, min(1.0, (bisect_right(sorted_values, float(value)) - 0.5) / len(sorted_values)))
~~~

Copy each feature before adding normalizedValue. Raise ValueError for a missing transform or nonnumeric raw value.

- [ ] **Step 4: Add failing similarity tests**

~~~python
WEIGHTS = {"median_slope_deg": .35, "terrain_roughness_m": .35, "relative_relief_m": .30}

def profile(value, flag="source-backed-derived"):
    return {"normalizedValue": value, "rawValue": value, "qualityFlag": flag}

def test_match_scores_higher_than_extreme():
    reference = {key: profile(.5) for key in WEIGHTS}
    assert score_candidate(reference, {key: profile(.5) for key in WEIGHTS}, WEIGHTS)[0] == 100.0
    assert score_candidate(reference, {key: profile(1.0) for key in WEIGHTS}, WEIGHTS)[0] < 100.0

def test_invalid_feature_renormalises_weights():
    reference = {key: profile(.5) for key in WEIGHTS}
    candidate = {key: profile(.5) for key in WEIGHTS}
    candidate["relative_relief_m"] = profile(.5, "invalid")
    score, coverage, contributions = score_candidate(reference, candidate, WEIGHTS)
    assert (score, coverage) == (100.0, .70)
    assert [row["normalizedWeight"] for row in contributions if row["available"]] == [.5, .5]
~~~

- [ ] **Step 5: Implement scoring records**

Each contribution holds featureKey, raw and normalised values from both profiles, available, featureDistance, normalizedWeight, and weightedContribution. Score is 100 times one minus weighted contribution sum. Raise ValueError if no feature is available.

- [ ] **Step 6: Verify and commit**

Run Task 1 tests; all must pass.

~~~powershell
git add pipeline/src/terra_analog/ranking.py pipeline/tests/test_ranking.py
git commit -m "feat: add local-population ranking core"
~~~

### Task 2: Reuse terrain extraction for study profiles

**Files:**
- Modify: pipeline/src/terra_analog/run_training_features.py
- Modify: pipeline/tests/test_terrain_features.py

**Interfaces:**
- offset_location(location, east_km, north_km) -> dict[str, object]
- build_location_feature_records(location, sampler, radius_m=20_000) -> list[dict[str, object]]
- Existing build_location_features(training_root) remains a 20 km display export.

- [ ] **Step 1: Write failing helper tests**

~~~python
def test_offset_location_does_not_mutate_input():
    original = {"center": {"latitudeDeg": 0.0, "longitudeDeg": 0.0}, "body": "earth"}
    shifted = offset_location(original, east_km=4.0, north_km=-4.0)
    assert original["center"] == {"latitudeDeg": 0.0, "longitudeDeg": 0.0}
    assert shifted["center"]["latitudeDeg"] < 0.0
    assert shifted["center"]["longitudeDeg"] > 0.0
~~~

Add a planar-raster sampler test at radius_m=3_000 which asserts the three features retain units, source IDs, and quality flags.

- [ ] **Step 2: Run to verify failure**

Run the existing terrain unittest file. Expected: FAIL because helper functions do not exist.

- [ ] **Step 3: Refactor without changing display behavior**

Thread radius_m through _coordinates, _sample_location, and _records_for_location. Offset a copied location using the current body-radius and longitude scaling logic. Keep display extraction at 20,000 m; only study profiles use 3,000 m.

- [ ] **Step 4: Verify and commit**

Run terrain tests, then regenerate display profiles with python -m terra_analog.run_training_features. Expected: 18 source-backed-derived display records remain.

~~~powershell
git add pipeline/src/terra_analog/run_training_features.py pipeline/tests/test_terrain_features.py
git commit -m "refactor: reuse terrain extraction for study samples"
~~~

### Task 3: Export populations, transforms, rankings, and evidence

**Files:**
- Create: pipeline/src/terra_analog/run_rankings.py
- Create: pipeline/tests/test_run_rankings.py

**Interfaces:**
- build_ranked_outputs(training_root: Path) -> dict[str, object]
- Writes study-population-features.json, model_manifest.json, enriched location-features.json, rankings.json, ranking-contributions.json, location-evidence.json, and validation-report.json.

- [ ] **Step 1: Write a failing deterministic integration test**

Use a small fixture sampler with valid records. Assert five rankings, 15 contribution records, score range 0–100, modelRunId, source IDs, and six transforms: Mars and Earth each for slope, roughness, and relief.

- [ ] **Step 2: Run to verify failure**

Run the new unittest. Expected: FAIL because run_rankings does not exist.

- [ ] **Step 3: Implement population and manifest assembly**

Use offsets (-8, -4, 0, 4, 8) and STUDY_RADIUS_M = 3_000. Generate 25 Mars samples around Gale and 25 Earth samples for each candidate. Store studyPopulationId, parentLocationId, offsets, raw feature fields, sorted raw values, sample count, source IDs, model run ID, analysis settings, and transformationVersion ecdf-midrank-v1.

- [ ] **Step 4: Implement ranking and evidence assembly**

Normalise display profiles with their own body transform, score five candidates, sort by descending score then candidate ID, and assign rank. Include every feature contribution. Evidence selects lowest/highest available contribution and includes the statement: "This is a data-derived terrain-similarity result, not mission-site approval."

- [ ] **Step 5: Implement export validation**

Reject missing model ID, source IDs, transforms, contributions, expected candidate count, positive coverage, or scores outside 0–100. Write successful results to validation-report.json before returning outputs.

- [ ] **Step 6: Verify and commit**

Run integration tests, then source-backed generation with python -m terra_analog.run_rankings. Expected: 25 Mars and up to 125 Earth samples, five ranked candidates, and all seven artifacts.

~~~powershell
git add pipeline/src/terra_analog/run_rankings.py pipeline/tests/test_run_rankings.py
git commit -m "feat: export explainable terrain rankings"
~~~

### Task 4: Document and track verified work

**Files:**
- Modify: data/training/README.md
- Modify: PEMBAGIAN-PERAN.md

- [ ] **Step 1: Document the reproducible command**

~~~powershell
$env:PYTHONPATH='pipeline/src'
& 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m terra_analog.run_rankings
~~~

Describe population scope, six transforms, weights, output paths, ignored-data policy, and terrain-only limitation.

- [ ] **Step 2: Update Member 2 checklist after validation**

Check off normalisation, weighted similarity, and sanity-check work only if validation-report.json reports success. Leave final packaging unchecked until separately listed deliverables, including candidates.geojson, exist.

- [ ] **Step 3: Run full verification**

~~~powershell
node --test pipeline/tests/training-catalog.test.mjs
$env:PYTHONPATH='pipeline/src'
& 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest pipeline/tests/test_terrain_features.py pipeline/tests/test_ranking.py pipeline/tests/test_run_rankings.py -v
git status --short
~~~

Expected: all tests pass; raw and processed data remain ignored.

- [ ] **Step 4: Commit docs**

~~~powershell
git add data/training/README.md PEMBAGIAN-PERAN.md
git commit -m "docs: document terrain ranking workflow"
~~~

## Self-Review

- Task 2 implements local study sampling; Task 1 covers ECDF, body separation, and weights; Task 3 produces every specified artifact and validation; Task 4 documents scope and updates status based on evidence.
- All public function names are defined in the task where they are introduced and used consistently later.

