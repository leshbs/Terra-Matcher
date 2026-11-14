# Source-Backed Terrain Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Produce validated, source-backed slope, roughness, and relative-relief records for one Mars scenario and five Earth candidate windows.

**Architecture:** Python modules read MOLA PDS and NASADEM HGT rasters using NumPy, sample each declared circular window onto a shared 500 m local grid, derive three terrain features on a 7×7 local neighbourhood, and write checksums, feature records, and a report under ignored training paths. The test suite covers numerical primitives and executes the source-backed integration run.

**Tech Stack:** Python 3, NumPy, standard-library unittest, JSON, SHA-256.

**Spec:** docs/superpowers/specs/2026-11-14-source-backed-terrain-features-design.md

## Global Constraints

- Read source rasters only from data/training/raw/; write results only under data/training/processed/2026-11-14-mvp-v1/.
- Do not install dependencies, commit raw/derived rasters, or write anything to public/.
- Use a 500 m analysis grid and 7×7 local neighbourhood for all six windows.
- Final records require rawValue, unit, sourceDatasetId, analysisResolutionM, localWindowKm, validCellCount, coverage, qualityFlag, and isFinal.
- Valid flags are source-backed-derived, partial-coverage, invalid; only a later fallback may use fixture-provisional.

---

### Task 1: Add numerical terrain primitives

**Files:**
- Create: pipeline/src/terra_analog/terrain_features.py
- Create: pipeline/tests/test_terrain_features.py

**Interfaces:**
- Produces: derive_feature_summary(elevation, spacing_m, window_cells), returning one summary per feature.

- [ ] **Step 1: Write failing numerical tests**

~~~python
import unittest
import numpy as np
from terra_analog.terrain_features import derive_feature_summary

class TerrainFeatureTests(unittest.TestCase):
    def test_planar_surface_has_expected_slope_and_zero_roughness(self):
        y, x = np.mgrid[0:15, 0:15]
        result = derive_feature_summary(x.astype(float) * 100, spacing_m=500, window_cells=7)
        self.assertAlmostEqual(result["median_slope_deg"]["rawValue"], np.degrees(np.arctan(0.2)), places=6)
        self.assertEqual(result["terrain_roughness_m"]["rawValue"], 0.0)

    def test_quality_flags_follow_coverage_thresholds(self):
        values = np.full((15, 15), 100.0)
        values[:4, :4] = np.nan
        self.assertEqual(derive_feature_summary(values, 500, 7)["relative_relief_m"]["qualityFlag"], "partial-coverage")
~~~

- [ ] **Step 2: Run the tests to verify they fail**

Run: $py = 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'; $env:PYTHONPATH = 'pipeline/src'; & $py -m unittest pipeline/tests/test_terrain_features.py

Expected: import failure for terrain_features.

- [ ] **Step 3: Implement derive_feature_summary**

Use central-difference slope, valid complete 7×7 finite windows, local elevation standard deviation, and local max-minus-min. Use median summaries. Set coverage to the valid local count divided by all possible centred windows. Assign source-backed-derived at coverage 0.95+, partial-coverage at 0.75+, otherwise invalid and rawValue None.

- [ ] **Step 4: Run the tests to verify they pass**

Run: same unittest command.

Expected: both tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add pipeline/src/terra_analog/terrain_features.py pipeline/tests/test_terrain_features.py
git commit -m "feat: derive terrain feature summaries"
~~~

### Task 2: Add raster readers, local sampling, and feature export

**Files:**
- Create: pipeline/src/terra_analog/source_rasters.py
- Create: pipeline/src/terra_analog/run_training_features.py
- Modify: pipeline/tests/test_terrain_features.py

**Interfaces:**
- MolaRaster.from_files(img_path, hdr_path) reads the 5632×11520 big-endian signed 16-bit tile spanning 0 to −44 latitude and 90 to 180 positive-east longitude.
- NasademCatalog(raw_root).sample(latitude, longitude) reads 3601×3601 big-endian signed 16-bit HGT tiles inferred from lower-left tile names.
- build_location_features(training_root) returns 18 records and a processing report.

- [ ] **Step 1: Write failing reader/export tests**

~~~python
from pathlib import Path
from terra_analog.source_rasters import NasademCatalog
from terra_analog.run_training_features import build_location_features

def test_nasadem_catalog_uses_lower_left_tile_name(tmp_path):
    (tmp_path / "NASADEM_HGT_n29e035").mkdir()
    assert NasademCatalog(tmp_path).tile_path(29.576, 35.421).name == "n29e035.hgt"

def test_source_backed_run_exports_three_records_per_location():
    records, report = build_location_features(Path("data/training"))
    assert len(records) == 18
    assert report["summary"]["locations"] == 6
    assert all(record["sourceDatasetId"] for record in records)
    assert all(record["qualityFlag"] in {"source-backed-derived", "partial-coverage", "invalid"} for record in records)
~~~

- [ ] **Step 2: Run the tests to verify they fail**

Run: same unittest command.

Expected: imports fail because readers and runner do not exist.

- [ ] **Step 3: Implement format reading and sampling**

Parse the MOLA ENVI header and sample its big-endian signed 16-bit grid with zero as no-data. Derive NASADEM tile paths from lower-left names and treat −32768 as no-data. Generate a 500 m grid within the 20 km radius by local Earth metre-per-degree conversion or Mars radius 3,396,000 m, then nearest-neighbour sample source elevation. Attach source IDs and SHA-256 checksums of every used IMG, HDR, XML, and HGT input. Write sorted JSON to raw/source-checksums.json, processed/2026-11-14-mvp-v1/location-features.json, and processing-report.json.

- [ ] **Step 4: Run the tests to verify they pass**

Run: same unittest command.

Expected: reader/path and source-backed integration tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add pipeline/src/terra_analog/source_rasters.py pipeline/src/terra_analog/run_training_features.py pipeline/tests/test_terrain_features.py
git commit -m "feat: process source-backed terrain features"
~~~

### Task 3: Run and validate the data package

**Files:**
- Create ignored artifacts: data/training/raw/source-checksums.json, data/training/processed/2026-11-14-mvp-v1/location-features.json, data/training/processed/2026-11-14-mvp-v1/processing-report.json
- Modify: data/training/README.md

**Interfaces:**
- Produces: eighteen records, three per six declared locations.

- [ ] **Step 1: Run the source-backed processor**

Run: $py = 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'; $env:PYTHONPATH = 'pipeline/src'; & $py -m terra_analog.run_training_features --training-root data/training

Expected: output reports six locations and eighteen feature records.

- [ ] **Step 2: Validate the final package**

Run: same unittest command; then parse location-features.json and count features.

Expected: tests pass and the artifact contains exactly 18 records with units, source IDs, and quality flags.

- [ ] **Step 3: Document generated data**

Update the training README to record that location-features.json comes from locally downloaded rasters, remains ignored, and is a terrain metric package rather than analog-site approval.

- [ ] **Step 4: Verify isolation and commit only code/docs**

Run: git status --short --ignored data/training; git diff --check

Expected: raw and processed artifacts remain ignored; only code, tests, and README are committed.

~~~bash
git add data/training/README.md
git commit -m "docs: record source-backed feature generation"
~~~

