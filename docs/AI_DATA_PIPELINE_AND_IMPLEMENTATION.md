# AI Data Processing & Web Implementation Guide — Terra Analog Mission Control

**Purpose:** Produce reproducible, scientifically bounded Mars-to-Earth analog rankings for the web MVP.  
**Method label:** Explainable feature-based similarity learning / nearest-neighbor ranking.  
**Not claimed:** A deep-learning discovery model, mission approval tool, or substitute for geological field validation.

## 1. Core method

The MVP compares small, curated geographic regions through a fixed feature vector. It ranks Earth regions by their distance to one selected Mars reference profile. This is appropriate for 40 person-hours because it is transparent, testable, and compatible with heterogeneous public datasets.

The production pipeline is offline. The website consumes only finalized artifacts and can optionally re-rank the already-curated candidates when the user adjusts bounded weights.

## 2. Dataset plan and provenance

Use only sources whose product page/license/citation can be recorded in `datasets`. Confirm the exact product/version and download terms at collection time; do not infer metadata from a map image.

| Need | Mars source family | Earth source family | MVP-derived feature | Notes |
|---|---|---|---|---|
| Elevation/terrain | Mars Global Surveyor Mars Orbiter Laser Altimeter (MOLA) gridded topography | Shuttle Radar Topography Mission (SRTM) or NASADEM | Relative relief | Use local-window values; absolute vertical datums are not directly equivalent. |
| Terrain shape | MOLA DEM-derived slope | SRTM/NASA DEM-derived slope | Median slope | Derive after projecting/resampling; state neighborhood size. |
| Surface roughness | MOLA DEM-derived roughness | SRTM/NASA DEM-derived roughness | Standard deviation/range of elevation or ruggedness | The feature must use an identical mathematical definition and documented analysis scale. |
| Optional environment | Carefully vetted Mars thermal/albedo product | NASA Earth observation aridity/thermal/vegetation proxy | One named proxy | Include only when both source coverage and science rationale are ready. |

[NASA describes MOLA](https://science.nasa.gov/mission/mars-global-surveyor/science-instruments/) as a Mars Global Surveyor instrument that collected topographic information and helped form a detailed topographic atlas. [NASA Earthdata documents SRTM products](https://www.earthdata.nasa.gov/s3fs-public/2025-05/SRTM_Quick_Guide.pdf), while [USGS Astrogeology provides Lunar Orbiter Laser Altimeter products](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m) for the later Moon extension. Record exact citations/URLs in the runtime source registry rather than relying on this guide alone.

## 3. Required data model terminology

- **Source raster:** original downloaded dataset; retained read-only with checksum.
- **Analysis grid:** common grid/resolution chosen per study region for calculating a feature. It is not a claim that sensors have equal native resolution.
- **Feature value:** one raw summary number per region and feature, with units and calculation parameters.
- **Transform:** body-specific percentile or robust scaling fit from the declared study population.
- **Model run:** immutable package containing source manifest, feature configuration, fitted transforms, rank output, and checksums.
- **Candidate hypothesis:** an Earth location returned by a model run, pending independent scientific/field review.

## 4. Repository/data layout

```text
data/
├─ raw/                 # ignored by Git; source files + README/checksums
├─ interim/             # clipped/reprojected rasters; reproducible but disposable
├─ processed/
│  └─ <model-run-id>/
│     ├─ location_features.parquet
│     ├─ rankings.parquet
│     ├─ candidates.geojson
│     ├─ layer_manifest.json
│     └─ validation_report.json
├─ external/            # manually curated literature/candidate evidence CSV
└─ manifests/           # source and model manifests committed to Git
pipeline/
├─ config/mvp_v1.yaml
├─ src/terra_analog/
│  ├─ catalog.py
│  ├─ extract.py
│  ├─ features.py
│  ├─ transforms.py
│  ├─ rank.py
│  ├─ validate.py
│  └─ export.py
├─ notebooks/01_exploration.ipynb
├─ scripts/run_mvp.py
└─ tests/
```

Raw licensed/large data should not enter the web repository or Vercel build. Commit configuration, provenance metadata, source code, small fixtures, and finalized public artifacts only when license terms allow.

## 5. Gathering and cataloging process

1. Define the scenario polygon/point plus window radius, Earth candidate polygons, and feature specification in `mvp_v1.yaml`.
2. Download original datasets directly from the authoritative provider.
3. Generate SHA-256 checksums and add a source record: provider, product/version, URL, access date, license, native resolution, CRS, units, citation, and known limitations.
4. Reject a dataset if its license is unclear, georeferencing/units are absent, or its intended physical meaning does not support the proposed cross-planet feature.
5. Create a small candidate-evidence table with an independent citation and a sentence explaining operational relevance; keep this distinct from the numerical rank.

## 6. Feature engineering process

### 6.1 Harmonize without erasing differences

- Preserve each body's original coordinate reference and record all transformations.
- Clip to defined regions; use a documented analysis grid appropriate to each source.
- Mask no-data values before every derivative calculation.
- Derive slope and roughness using the same algorithm and stated neighborhood in physical units where feasible.
- Calculate regional summaries such as median slope, interquartile elevation range, and robust roughness statistic.
- Store `raw_value`, `raw_unit`, `analysis_resolution`, `window_m`, and `dataset_id` per feature.

### 6.2 Minimum feature schema

```yaml
features:
  - key: median_slope_deg
    display_name: Median slope
    unit: degrees
    default_weight: 0.35
  - key: terrain_roughness_m
    display_name: Terrain roughness
    unit: meters
    default_weight: 0.35
  - key: relative_relief_m
    display_name: Relative relief
    unit: meters
    default_weight: 0.30
```

Do not add mineralogy, dust, biology, caves, thermal extremes, or water/ice merely to sound comprehensive. Add each only when there is a defensible paired data product, an explicit comparable definition, and enough time to validate it.

## 7. Training / fitting process

For this MVP, “training” means fitting transforms and preparing an unsupervised nearest-neighbor similarity index; it does **not** mean fitting a supervised model that claims ground truth labels.

1. Split regions into `earth_study_population`, `mars_study_population`, `mars_reference_scenarios`, and `earth_candidate_catalog`.
2. Run robust feature validation: valid units, no impossible values, expected missing-data fraction, and no duplicated coordinates.
3. Fit a `RobustScaler` or percentile transform separately for Earth and Mars study populations. Persist its parameters in `model_manifest.json`.
4. Transform only the matching body's raw values. Never fit transforms on a browser query or mix bodies into a raw-value scaler.
5. Apply the fixed default weight vector and calculate weighted L1 distance. Retain per-feature distance and contribution.
6. Optionally build a `NearestNeighbors(metric='manhattan')` index for batch ranking. For 5–10 candidates, direct deterministic calculation is simpler and preferred.
7. Export rankings, feature profiles, contributions, data coverage, and interpretation inputs under one immutable `model_run_id`.

### Why no deep learning in MVP

There are no trustworthy labels for “true Earth analog of this Mars site” at the required scale. Deep learning would require a carefully designed labeled objective, substantially more compute/data governance, and an evaluation protocol. It would add opacity without proving more validity. Transparent similarity is the stronger scientific and competition choice now.

## 8. Score, confidence, and explanation

```python
available = [f for f in features if reference[f].present and candidate[f].present]
weight_total = sum(weights[f] for f in available)
normalized_weights = {f: weights[f] / weight_total for f in available}
distance_by_feature = {
    f: abs(reference[f].normalized - candidate[f].normalized)
    for f in available
}
weighted_distance = sum(normalized_weights[f] * distance_by_feature[f] for f in available)
score = 100 * (1 - min(weighted_distance, 1))
data_coverage = weight_total / sum(weights.values())
```

`confidence` is a data-completeness/quality indicator, not a probability the Earth candidate is a true analog. Derive it from feature coverage and the lowest input quality grade. The interface must use wording such as “High data coverage” rather than “92% scientifically certain.”

Interpretation rules are deterministic: a low contribution means close normalized values for that feature; high contribution highlights the major mismatch. A candidate with low coverage cannot outrank a complete candidate solely on a partial score; either filter it from the default list or visually separate it with a “partial profile” label.

## 9. Validation gates

### Data validation

- All required feature rows have a dataset ID, raw unit, transform name, and quality flag.
- Source checksum and product metadata match the model manifest.
- No-data values never become zero; masks survive reprojection/resampling.
- Derived slope values stay in 0–90 degrees; distance/score values stay in declared ranges.

### Method validation

- Re-running the same configuration creates identical ranking outputs, aside from run timestamp.
- The contribution values sum to the stored total distance within a small numerical tolerance.
- Extreme synthetic profiles rank lower than deliberately similar synthetic profiles.
- Sensitivity test: perturb each default weight by ±10%; flag candidates whose rank changes substantially.
- Hold out one known/expected terrestrial analog as a sanity check, but do not tune until it “wins”; report the outcome.

### Human/science review

- A team member not writing the code checks feature definition, units, citations, and caveat text.
- Confirm each featured candidate has one evidence note beyond the score.
- Review all visual labels for accidental claims of discovery, habitability, safety, or landing suitability.

## 10. Finalization and release package

Finalization occurs only after all validation gates pass. Create a directory named by a stable run identifier, for example `2026-11-14-mvp-v1`, containing:

```text
model_manifest.json      # algorithm, config checksum, transform parameters, source IDs
source_manifest.json     # dataset citations, license, access date, checksums
location_features.parquet
rankings.parquet
ranking_contributions.parquet
candidates.geojson
layer_manifest.json      # asset URL, display unit, legend, resolution, source ID
validation_report.json
```

The finalization script must reject artifact export if a score lacks a contribution, a location feature lacks provenance, or a public asset lacks attribution. Set the related `model_runs.status` to `ready` only after import validation succeeds.

## 11. Web integration

1. The pipeline exports `locations`, `location_features`, `rankings`, `ranking_contributions`, datasets, and evidence as CSV/JSON import files.
2. A controlled server-side import script validates Zod/JSON-schema equivalents, opens one database transaction per model run, inserts the model run as `draft`, imports data, runs referential-integrity checks, then marks it `ready`.
3. The web API selects only the current `ready` model run defined by `DATA_MANIFEST_VERSION` or a server-side configuration record.
4. MapLibre loads the matching `candidates.geojson` and layer assets; API responses provide feature values and provenance, not expensive grids.
5. Browser weight adjustment uses the stored normalized profiles and returns a transient, clearly labeled “custom weighting” ranking. It neither writes to the database nor retrains the model.
6. The comparison screen merges response fields into three groups: matched measurable features, unmodeled/limited conditions, and source evidence.

## 12. Failure and fallback behavior

| Condition | Required behavior |
|---|---|
| Dataset download fails | Use only a previously verified, cited processed artifact; mark its retrieval date. Do not substitute an uncited image. |
| Optional feature unavailable | Exclude it from the model run and UI; re-normalize remaining declared weights. |
| A candidate has missing required feature | Do not rank it in default complete-profile results; show it separately only if useful. |
| Supabase unavailable | Render bundled demonstration data with a visible “offline demo dataset” banner and provenance link. |
| User requests weights outside bounds | Return validation error and preserve previous ranking. |
| Model run invalid | Keep prior ready run; never partially publish draft output. |

## 13. Moon-ready extension

The same process can later include `moon` records, LOLA terrain products, Moon-specific study populations, and a separate caveat schema. Do not combine Mars and Moon into one model run by default: their operational questions and unmodeled conditions differ. The common contracts remain `celestial_bodies`, `datasets`, `locations`, `location_features`, `model_runs`, rankings, and provenance.

## 14. MVP checklist

- [ ] One Mars reference scenario has a source-backed profile.
- [ ] Five Earth candidates have source-backed profiles and evidence notes.
- [ ] Three required features use documented, consistent definitions.
- [ ] Each profile is body-normalized and retains raw value/unit.
- [ ] Rankings include score, coverage, contributions, model run, and limitations.
- [ ] Artifacts and database import pass all validation gates.
- [ ] Vercel deployment renders map, comparison, provenance, and fallback state.
- [ ] Demo narration avoids unsupported AI/scientific claims.
