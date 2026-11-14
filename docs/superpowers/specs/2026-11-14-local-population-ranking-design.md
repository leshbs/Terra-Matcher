# Local-Population Normalisation and Ranking Design

## Goal

Rank the five curated Earth candidates against the Gale Crater reference with an explainable, provenance-rich terrain-similarity model. The model must retain raw observations while comparing only body-normalised feature values.

## Study populations

The existing 20 km scenario/candidate windows are the display profiles. They are not sufficient by themselves to define a stable normalisation transform. The pipeline will derive additional, non-display 3 km feature samples from a fixed 5×5 local offset grid:

```text
offsets in kilometres: -8, -4, 0, 4, 8 east × -8, -4, 0, 4, 8 north
```

- **Mars study population:** 25 samples around Gale Crater.
- **Earth study population:** 25 samples around each of the five candidates, for up to 125 samples.
- Each sample uses the same downloaded source raster, 500 m analysis spacing, 7×7 local neighbourhood, no-data handling, and feature definitions as the display profile.

Samples are not Earth analog claims and never appear in the user-facing candidate ranking. They exist only to fit a declared transformation scope.

## Normalisation

For each celestial body and each feature, fit an empirical cumulative distribution function (ECDF) to valid study-population raw values. Store sorted raw values, sample count, source model run, and transformation version in `model_manifest.json`.

The normalised value is the mid-rank percentile:

```text
percentile = (count(study_value ≤ raw_value) − 0.5) / sample_count
```

and is bounded to `[0, 1]`. Mars reference values are transformed only by the Mars population; Earth candidates are transformed only by the Earth population. This does not make vertical datums or raw feature magnitudes equal; it compares relative terrain position inside the declared study populations.

## Similarity model

Use the fixed default weights:

| Feature | Weight |
|---|---:|
| `median_slope_deg` | 0.35 |
| `terrain_roughness_m` | 0.35 |
| `relative_relief_m` | 0.30 |

For every candidate, exclude a feature only if either profile is `invalid`; renormalise remaining weights. Compute:

```text
distance_i = |mars_percentile_i − earth_percentile_i|
weighted_distance = Σ(normalised_weight_i × distance_i)
similarity_score = 100 × (1 − weighted_distance)
data_coverage = Σ(available original weights)
```

Each `ranking-contributions.json` record stores feature key, raw values, normalised values, feature distance, normalised weight, and weighted contribution. The strongest match has the lowest contribution; the largest mismatch has the highest contribution.

## Outputs

All artifacts remain under the ignored `data/training/processed/2026-11-14-mvp-v1/` directory:

```text
study-population-features.json
model_manifest.json
location-features.json          # enriched with normalizedValue
rankings.json
ranking-contributions.json
location-evidence.json
validation-report.json
```

`location-evidence.json` combines the pre-existing operational hypothesis, limitations, source IDs, and automatically generated strongest-match/largest-mismatch explanation. It must state that the result is a data-derived terrain similarity, not mission-site approval.

## Validation

- Unit tests prove ECDF mid-rank calculation, body separation, weight renormalisation, score ordering, contribution sum, and data coverage.
- A synthetic profile exactly matching the Mars percentile profile must score higher than an extreme profile.
- Integration validation asserts five rankings, three contribution records per candidate when coverage is complete, score range 0–100, and a manifest entry for every transform.
- Export fails if any ranking lacks model run ID, source provenance, coverage, or contributions.

## Limitations

- Study populations are local MVP context, not global Mars/Earth distributions.
- The Earth population contains samples from the displayed candidate regions; ranking is a curated-catalog comparison, not global discovery.
- Terrain-only rankings do not model atmosphere, gravity, radiation, biology, field access, safety, ownership, or permissions.
