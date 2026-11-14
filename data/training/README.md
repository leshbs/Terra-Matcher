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
