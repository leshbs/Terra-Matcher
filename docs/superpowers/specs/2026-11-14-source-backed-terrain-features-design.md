# Source-Backed Terrain Features Design

## Goal

Calculate reproducible, source-backed terrain features for the Gale Crater reference scenario and five Earth candidate windows using the downloaded MOLA and NASADEM files. Export a machine-readable feature package with units, source IDs, coverage, checksums, and quality flags.

## Inputs

- Mars: `data/training/raw/mars/megt00n090hb.img`, with its `.hdr` and `.xml` metadata files. The raster is the MOLA 128-pixel-per-degree topography tile covering 0–44°S and 90–180°E, which includes Gale Crater.
- Earth: extracted NASADEM HGT tiles under `data/training/raw/earth/NASADEM_HGT_*/*.hgt`. The six downloaded tiles cover the five declared 20 km candidate windows; Mauna Kea uses its two adjoining latitude tiles.
- Study windows: `data/training/locations.json`.
- Feature definition and paths: `data/training/preparation-manifest.json`.

## Analysis grid

Each source is sampled onto a local, 500 m spacing grid centred on the declared location and restricted to a 20 km radius circle. The pipeline uses nearest-neighbour sampling, with metric degree-to-distance conversion based on the local latitude and planetary radius. This makes the feature scale consistent without pretending that the source sensors or vertical datums are identical.

The selected grid is deliberately coarser than NASADEM and close to MOLA's approximately 463 m equatorial sampling. It is appropriate for the terrain-scale MVP only; it must not be used for fine rover-hazard assessment.

## Features

For every valid analysis-grid cell with a complete 7×7 local neighbourhood (approximately 3 km across):

- `median_slope_deg`: median of central-difference terrain slope, in degrees.
- `terrain_roughness_m`: median local elevation standard deviation, in metres.
- `relative_relief_m`: median local maximum minus local minimum elevation, in metres.

No-data source values are masked before resampling and feature calculation. A location has one record for each feature, with `sourceDatasetId`, `analysisResolutionM`, `localWindowKm`, `validCellCount`, `coverage`, and `qualityFlag`.

## Quality flags

- `source-backed-derived`: feature coverage is at least 95%.
- `partial-coverage`: coverage is at least 75% and below 95%; it remains visible but must not silently receive a full-confidence score.
- `invalid`: coverage is below 75% or no valid neighbourhood remains; `rawValue` is `null`.

The source data has been downloaded, so no fixture is produced unless a later processing error makes a feature invalid. A fixture, if ever needed, must use `qualityFlag: "fixture-provisional"`, `isFinal: false`, and cannot replace a source-backed record.

## Outputs

```text
data/training/
├─ raw/source-checksums.json
└─ processed/2026-11-14-mvp-v1/
   ├─ location-features.json
   └─ processing-report.json
```

The output root is ignored by Git and remains outside `public/`. `location-features.json` is the handoff artifact for the ranking pipeline; a later integrator may create a separate, validated demo export.

## Implementation

Use Python with `numpy`, which is already supplied by the workspace runtime. Implement format readers directly:

- MOLA: parse the ENVI header and read signed big-endian 16-bit cells from the PDS image.
- NASADEM: parse the 3601×3601 signed big-endian HGT cell array; derive tile origin from its filename.

Do not install or commit new geospatial libraries. The script writes stable JSON with sorted keys and uses SHA-256 for every raw source file.

## Validation

- Unit tests use small in-memory elevation grids to prove slope, roughness, relief, no-data masking, and each quality threshold.
- An integration test reads the downloaded files and asserts exactly 18 records: three features for six locations.
- Every record references an existing dataset ID, carries its required unit, and has a valid quality flag.
- The processing report has input checksums, no output path beginning with `public/`, and a summary of valid/partial/invalid features.

## Limitations

- MOLA and NASADEM have different source resolutions, sensing methods, and vertical reference surfaces.
- Only terrain morphology is measured; gravity, atmosphere, radiation, biology, access, and legal/land permissions are not modelled.
- Results are explainable terrain-similarity inputs, not analog-site approval, rover safety assessment, or mission planning output.
