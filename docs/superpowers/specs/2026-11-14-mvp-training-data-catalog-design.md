# MVP Training Data Catalog Design

## Goal

Create a versioned, source-backed training-data catalog for one Mars reference scenario and five Earth terrain candidates, while keeping every training artifact outside `public/`.

## Scope

The catalog supports the offline, explainable terrain-similarity MVP described in `docs/AI_DATA_PIPELINE_AND_IMPLEMENTATION.md`. It records the two authoritative DEM products, six study windows, citations, resolution, units, access details, and a reproducible preparation recipe. It does not download multi-gigabyte rasters, calculate terrain features, or publish web assets.

## Dataset decisions

### Mars

- **Product:** MGS MOLA Mission Experiment Gridded Data Record (MEGDR), topography, final v2.0/PDS4 maintained bundle.
- **Provider:** NASA PDS Geosciences Node, with USGS Astrogeology distribution metadata.
- **Native resolution:** 128 pixels per degree, approximately 463 m/pixel at the equator.
- **Unit:** metres, elevation above the MOLA areoid.
- **Reference scenario:** `mars-gale-aeolis-palus-v1`, a 20 km radius study window centred at 4.5895°S, 137.4417°E.
- **Feature approach:** resample only after clipping; calculate median slope in degrees, terrain roughness in metres, and relative relief in metres with a documented 3 km local window.

### Earth

- **Product:** NASADEM Merged DEM Global 1 arc second V001 (`NASADEM_HGT`).
- **Provider:** NASA EOSDIS Land Processes DAAC.
- **Native resolution:** 1 arc-second, roughly 30 m at the equator; geographic-grid ground sampling varies with latitude.
- **Unit:** metres, elevation relative to the EGM96 geoid.
- **Candidate windows:** five 20 km radius study windows at Atacama Desert (Chile), Wadi Rum (Jordan), Mauna Kea (Hawai'i), Teide (Tenerife), and Craters of the Moon (Idaho).
- **Feature approach:** use the same feature definitions and 3 km local window as Mars, but retain native/source and analysis resolution independently. Values are normalised within their own body population; raw elevations are never compared as equivalent vertical datums.

## File layout

```text
data/
└─ training/
   ├─ datasets.json
   ├─ locations.json
   ├─ preparation-manifest.json
   └─ README.md
```

`datasets.json` is the source registry. Each record requires `id`, `provider`, `product`, `version`, `url`, `accessUrl`, `license`, `nativeResolution`, `unit`, `citation`, `accessedAt`, and `limitations`.

`locations.json` is the curated scenario/candidate registry. Each location requires a stable ID, celestial body, centre coordinate, radius, human-readable operational hypothesis, limitation statement, and source-dataset IDs.

`preparation-manifest.json` is the machine-readable contract for a later offline raster pipeline. It declares requested source tiles, target analysis resolution, required feature definitions, no-data behaviour, and expected output locations. It does not claim that data has already been downloaded or features calculated.

## Data flow and safety

```text
Authoritative PDS / Earthdata source
              ↓ manual authenticated retrieval
data/training/raw/ (gitignored; checksum recorded)
              ↓ offline clipping and derivation
data/training/processed/<model-run-id>/ (gitignored)
              ↓ validated small export only
future public/data/ web fixture
```

Raw source files and derived rasters are intentionally absent from Git and from `public/`. The catalog is the committed provenance record. A later export step may only create public JSON after feature values and citations pass validation.

## Validation

- Validate every JSON document with a Node test: unique IDs, required provenance fields, valid longitude/latitude ranges, exactly one Mars scenario, exactly five Earth candidates, and no `public/` paths.
- Confirm the two citations resolve to authoritative provider pages.
- Validate each required feature has an explicit unit, formula, and physical analysis window.
- Confirm every location references an existing dataset ID.

## Non-goals

- No model fitting, ranking, or claim that candidates are approved analog sites.
- No raw data replication to Supabase, Google Drive, or web deployment.
- No downloadable training corpus from the app.

## References

- MOLA MEGDR PDS4 bundle: <https://pds-geosciences.wustl.edu/missions/mgs/megdr.html>
- USGS MOLA 463 m DEM distribution metadata: <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m>
- NASADEM user guide: <https://lpdaac.usgs.gov/documents/1273/NASADEM_User_Guide_V11.pdf>
