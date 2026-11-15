# Training data catalog

This folder is the committed provenance and preparation contract for the offline terrain-similarity MVP. It is deliberately separate from `public/`, which may contain only final web assets supplied by the integrator.

## Files

- `datasets.json` records the authoritative Mars and Earth DEM products, citations, units, resolution, licence/access notes, and limitations.
- `locations.json` records one Mars reference scenario and five Earth candidate windows. Every record is a terrain-analog hypothesis, not a mission recommendation or field-site approval.
- `preparation-manifest.json` declares the three comparable features and the procedure for creating a future model run.

## Validation

Run the dependency-free catalog test from the repository root:

```powershell
node --test pipeline/tests/training-catalog.test.mjs
```

The test verifies provenance fields, coordinate bounds, dataset references, the one-Mars/five-Earth scope, feature definitions, and the prohibition on `public/` output paths.

## Data preparation

1. Sign in to NASA Earthdata before retrieving NASADEM granules.
2. Download only source raster files that intersect the declared 20 km windows.
3. Save raw source files under `data/training/raw/` and record the original URL, access date, SHA-256 checksum, and raster metadata in `source-checksums.json`.
4. Store clipped and reprojected work files under `data/training/interim/`.
5. Store a reproducible model-run package under `data/training/processed/<model-run-id>/`.
6. Derive slope, terrain roughness, and relative relief with the 3 km local window specified in `preparation-manifest.json`.

The `raw/`, `interim/`, and `processed/` folders are ignored by Git. They must not be placed in `public/`, uploaded to the web deployment, or treated as a user-downloadable training corpus. Only a later validated handoff owned by the integrator may create small, cited files in `public/data/demo/`.

## Generated terrain package

After the downloaded MOLA and NASADEM rasters are present, generate the local source-backed terrain package with:

```powershell
$py = 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:PYTHONPATH = 'pipeline/src'
& $py -m terra_analog.run_training_features --training-root data/training
```

The command writes `raw/source-checksums.json` and, for model run `2026-11-14-mvp-v1`, `processed/2026-11-14-mvp-v1/location-features.json` plus `processing-report.json`. These artifacts are generated from locally downloaded source rasters, remain ignored by Git, and report terrain metrics only. They are not analog-site approval, rover-safety assessment, or mission-planning output.

## Local-population ranking package

After generating the display profiles, build the source-backed ranking package with:

```powershell
$py = 'C:\Users\Lesharo Bladen S\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$env:PYTHONPATH = 'pipeline/src'
& $py -m terra_analog.run_rankings --training-root data/training
```

The runner derives 3 km study profiles at a fixed 5×5 offset grid (`-8`, `-4`, `0`, `4`, and `8` km east and north): 25 profiles around Gale and 25 around each Earth candidate. It fits separate Mars and Earth ECDF mid-rank transforms for slope, terrain roughness, and relative relief. The fixed similarity weights are 0.35, 0.35, and 0.30 respectively; an invalid feature is excluded and the remaining weights are renormalised.

The ignored model-run folder then contains `study-population-features.json`, `explorer-grid-samples.json`, `model_manifest.json`, enriched `location-features.json`, `rankings.json`, `ranking-contributions.json`, `location-evidence.json`, `candidates.geojson`, and `validation-report.json`. `explorer-grid-samples.json` pivots the 3 features into 150 source-backed samples: 25 fixed offset-grid samples for each Mars/Earth window, ready for a controlled seed importer. The GeoJSON is a six-point FeatureCollection: one Mars Gale reference point and five Earth candidate points. Candidate properties add rank, score, coverage, source IDs, and strongest-match/largest-mismatch feature keys; the Gale reference has no candidate rank or score. The manifest retains sorted transformation values, source IDs, sample counts, run ID, and transformation version. Rankings are a data-derived terrain comparison within the declared local populations, not global discovery, field approval, rover-safety assessment, or mission-site approval.
