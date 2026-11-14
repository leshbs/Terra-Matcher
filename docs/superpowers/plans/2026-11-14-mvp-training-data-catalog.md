# MVP Training Data Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Deliver a validated, source-backed training catalog for one Gale Crater Mars scenario and five Earth candidate windows without putting data in \`public/\`.

**Architecture:** Commit compact catalog and preparation JSON under \`data/training/\`; keep raw and processed rasters in gitignored subfolders there. A dependency-free Node validator reads all three JSON files and enforces provenance, location counts, geographic bounds, source references, and the ban on public paths. Node's built-in test runner exercises this validator.

**Tech Stack:** JSON, Node.js built-in \`node:test\` and \`node:assert/strict\`.

**Spec:** \`docs/superpowers/specs/2026-11-14-mvp-training-data-catalog-design.md\`

## Global Constraints

- Training data must live under \`data/training/\`, never \`public/\`.
- Do not download, commit, or publish raw/derived raster assets in this task.
- The catalog contains exactly one Mars scenario and five Earth candidates.
- Use MOLA MEGDR v2.0/PDS4 for Mars and NASADEM Merged DEM Global 1 arc second V001 for Earth.
- Feature definitions are median slope in degrees, terrain roughness in metres, and relative relief in metres, all at a 3 km local window.
- The catalog must preserve citation, resolution, unit, licence/access notes, and limitations.

---

### Task 1: Add catalog validation and storage guardrails

**Files:**
- Create: \`pipeline/src/terra_analog/validate-training-catalog.mjs\`
- Create: \`pipeline/tests/training-catalog.test.mjs\`
- Create: \`.gitignore\`

**Interfaces:**
- Consumes: parsed \`datasets\`, \`locations\`, and \`manifest\` JSON.
- Produces: \`validateTrainingCatalog({ datasets, locations, manifest })\`, returning \`{ datasetCount, marsScenarioCount, earthCandidateCount }\` or throwing an invariant error.

- [ ] **Step 1: Write the failing test**

\`\`\`js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrainingCatalog } from '../src/terra_analog/validate-training-catalog.mjs';

const valid = {
  datasets: [{
    id: 'mars-mola-megdr-v2',
    provider: 'NASA PDS Geosciences Node',
    product: 'MGS MOLA MEGDR Topography',
    version: '2.0 / PDS4 maintained bundle',
    url: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
    accessUrl: 'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif',
    license: 'CC0 / public domain',
    nativeResolution: { value: 128, unit: 'pixels per degree', approximateMetersAtEquator: 463 },
    unit: 'm above MOLA areoid',
    citation: 'Smith et al. (2001), JGR, 106(E10), 23689-23722.',
    accessedAt: '2026-11-14',
    limitations: ['Interpolated gaps exist between MOLA tracks.']
  }],
  locations: [{ id: 'mars-gale-aeolis-palus-v1', kind: 'reference-scenario', body: 'mars', center: { latitude: -4.5895, longitude: 137.4417 }, radiusKm: 20, datasetIds: ['mars-mola-megdr-v2'] }],
  manifest: { outputRoot: 'data/training/processed/2026-11-14-mvp-v1', features: [{ key: 'median_slope_deg', unit: 'degrees', localWindowKm: 3 }, { key: 'terrain_roughness_m', unit: 'm', localWindowKm: 3 }, { key: 'relative_relief_m', unit: 'm', localWindowKm: 3 }] }
};

test('accepts a source-backed Mars scenario', () => {
  assert.deepEqual(validateTrainingCatalog(valid), { datasetCount: 1, marsScenarioCount: 1, earthCandidateCount: 0 });
});

test('rejects public output paths and orphan dataset references', () => {
  assert.throws(() => validateTrainingCatalog({ ...valid, manifest: { ...valid.manifest, outputRoot: 'public/data/demo' } }), /public/);
  assert.throws(() => validateTrainingCatalog({ ...valid, locations: [{ ...valid.locations[0], datasetIds: ['missing'] }] }), /missing/);
});
\`\`\`

- [ ] **Step 2: Verify RED**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: module-not-found failure for \`validate-training-catalog.mjs\`.

- [ ] **Step 3: Implement the validator**

\`\`\`js
export function validateTrainingCatalog({ datasets, locations, manifest }) {
  const ids = new Set();
  for (const dataset of datasets) {
    for (const key of ['id', 'provider', 'product', 'version', 'url', 'accessUrl', 'license', 'nativeResolution', 'unit', 'citation', 'accessedAt', 'limitations']) {
      if (!dataset[key] || (Array.isArray(dataset[key]) && dataset[key].length === 0)) throw new Error(\`dataset \${dataset.id ?? '<unknown>'} missing \${key}\`);
    }
    if (ids.has(dataset.id)) throw new Error(\`duplicate dataset ID: \${dataset.id}\`);
    ids.add(dataset.id);
  }
  if (String(manifest.outputRoot).startsWith('public/')) throw new Error('public paths are not permitted for training output');
  for (const location of locations) {
    if (!Number.isFinite(location.center?.latitude) || location.center.latitude < -90 || location.center.latitude > 90) throw new Error(\`invalid latitude: \${location.id}\`);
    if (!Number.isFinite(location.center?.longitude) || location.center.longitude < -180 || location.center.longitude > 360) throw new Error(\`invalid longitude: \${location.id}\`);
    for (const datasetId of location.datasetIds ?? []) if (!ids.has(datasetId)) throw new Error(\`unknown dataset ID: \${datasetId}\`);
  }
  const marsScenarioCount = locations.filter((item) => item.body === 'mars' && item.kind === 'reference-scenario').length;
  const earthCandidateCount = locations.filter((item) => item.body === 'earth' && item.kind === 'candidate').length;
  if (marsScenarioCount !== 1) throw new Error('catalog must contain exactly one Mars reference scenario');
  if (earthCandidateCount !== 5 && earthCandidateCount !== 0) throw new Error('catalog must contain exactly five Earth candidates');
  for (const feature of manifest.features ?? []) if (!feature.key || !feature.unit || feature.localWindowKm !== 3) throw new Error(\`invalid feature: \${feature.key ?? '<unknown>'}\`);
  return { datasetCount: datasets.length, marsScenarioCount, earthCandidateCount };
}
\`\`\`

- [ ] **Step 4: Add raw-raster ignores**

\`\`\`gitignore
data/training/raw/
data/training/interim/
data/training/processed/
\`\`\`

- [ ] **Step 5: Verify GREEN and commit**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: both tests pass.

\`\`\`bash
git add .gitignore pipeline/src/terra_analog/validate-training-catalog.mjs pipeline/tests/training-catalog.test.mjs
git commit -m "feat: validate training data catalog"
\`\`\`

### Task 2: Create the dataset and location registries

**Files:**
- Create: \`data/training/datasets.json\`
- Create: \`data/training/locations.json\`
- Modify: \`pipeline/tests/training-catalog.test.mjs\`

**Interfaces:**
- Consumes: two source identifiers.
- Produces: two dataset records and six location records for offline preparation.

- [ ] **Step 1: Add a failing committed-catalog test**

\`\`\`js
import { readFile } from 'node:fs/promises';
const loadJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('dataset and location registries contain one Mars scenario and five Earth candidates', async () => {
  const [datasetDocument, locationDocument] = await Promise.all([
    loadJson('../../data/training/datasets.json'),
    loadJson('../../data/training/locations.json')
  ]);
  assert.deepEqual(validateTrainingCatalog({ datasets: datasetDocument.datasets, locations: locationDocument.locations, manifest: valid.manifest }), {
    datasetCount: 2, marsScenarioCount: 1, earthCandidateCount: 5
  });
});
\`\`\`

- [ ] **Step 2: Verify RED**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: \`ENOENT\` for \`data/training/datasets.json\`.

- [ ] **Step 3: Create the exact dataset records**

Create records with IDs \`mars-mola-megdr-v2\` and \`earth-nasadem-hgt-v001\`, respectively:

| Field | MOLA value | NASADEM value |
|---|---|---|
| provider | NASA PDS Geosciences Node | NASA EOSDIS Land Processes DAAC |
| product | Mars Global Surveyor MOLA MEGDR Topography | NASADEM Merged DEM Global 1 arc second |
| version | 2.0 / PDS4 maintained bundle | V001 |
| url | \`https://pds-geosciences.wustl.edu/missions/mgs/megdr.html\` | \`https://doi.org/10.5067/MEaSUREs/NASADEM/NASADEM_HGT.001\` |
| accessUrl | \`https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif\` | \`https://search.earthdata.nasa.gov/search?q=NASADEM_HGT%20001\` |
| nativeResolution | 128 pixels/degree; ~463 m at equator | 1 arc-second; ~30 m at equator |
| unit | m above MOLA areoid | m relative to EGM96 geoid |

Use \`accessedAt: "2026-11-14"\`. Include the MOLA Smith et al. 2001 DOI citation \`https://doi.org/10.1029/2000JE001364\`; NASA JPL 2020 NASADEM citation; explicit access/licence notes; and two limitations per source.

- [ ] **Step 4: Create the exact location records**

Every record has \`radiusKm: 20\`, a non-empty \`operationalHypothesis\`, \`limitations\`, \`datasetIds\`, and \`status: "planned-for-preparation"\`.

| ID | kind | body | centre latitude, longitude | dataset ID |
|---|---|---|---|---|
| \`mars-gale-aeolis-palus-v1\` | reference-scenario | mars | -4.5895, 137.4417 | \`mars-mola-megdr-v2\` |
| \`earth-atacama-desert-chile-v1\` | candidate | earth | -23.4790, -68.3120 | \`earth-nasadem-hgt-v001\` |
| \`earth-wadi-rum-jordan-v1\` | candidate | earth | 29.5760, 35.4210 | \`earth-nasadem-hgt-v001\` |
| \`earth-mauna-kea-hawaii-v1\` | candidate | earth | 19.8207, -155.4681 | \`earth-nasadem-hgt-v001\` |
| \`earth-teide-tenerife-v1\` | candidate | earth | 28.2724, -16.6425 | \`earth-nasadem-hgt-v001\` |
| \`earth-craters-of-the-moon-idaho-v1\` | candidate | earth | 43.4166, -113.5164 | \`earth-nasadem-hgt-v001\` |

All candidate limitations explicitly exclude atmospheric, gravity, radiation, biological, access, and land-permission equivalence.

- [ ] **Step 5: Verify GREEN and commit**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: all tests pass.

\`\`\`bash
git add data/training/datasets.json data/training/locations.json pipeline/tests/training-catalog.test.mjs
git commit -m "data: add MVP Mars and Earth training catalog"
\`\`\`

### Task 3: Declare reproducible preparation and complete validation

**Files:**
- Create: \`data/training/preparation-manifest.json\`
- Create: \`data/training/README.md\`
- Modify: \`pipeline/tests/training-catalog.test.mjs\`

**Interfaces:**
- Consumes: catalog dataset/location IDs.
- Produces: the offline-handoff contract, with no downloaded raster or feature claims.

- [ ] **Step 1: Add a failing manifest-contract test**

\`\`\`js
test('preparation manifest has exactly the three comparable features', async () => {
  const manifest = await loadJson('../../data/training/preparation-manifest.json');
  assert.equal(manifest.modelRunId, '2026-11-14-mvp-v1');
  assert.equal(manifest.rawRoot, 'data/training/raw');
  assert.equal(manifest.outputRoot.startsWith('public/'), false);
  assert.deepEqual(manifest.features.map((feature) => feature.key), [
    'median_slope_deg', 'terrain_roughness_m', 'relative_relief_m'
  ]);
  assert.ok(manifest.features.every((feature) => feature.localWindowKm === 3));
});

test('complete committed catalog validates against its manifest', async () => {
  const [datasetDocument, locationDocument, manifest] = await Promise.all([
    loadJson('../../data/training/datasets.json'),
    loadJson('../../data/training/locations.json'),
    loadJson('../../data/training/preparation-manifest.json')
  ]);
  assert.deepEqual(validateTrainingCatalog({ datasets: datasetDocument.datasets, locations: locationDocument.locations, manifest }), {
    datasetCount: 2, marsScenarioCount: 1, earthCandidateCount: 5
  });
});
\`\`\`

- [ ] **Step 2: Verify RED**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: \`ENOENT\` for \`data/training/preparation-manifest.json\`.

- [ ] **Step 3: Create the concrete preparation manifest**

Use \`modelRunId: "2026-11-14-mvp-v1"\`, roots \`data/training/raw\`, \`data/training/interim\`, and \`data/training/processed/2026-11-14-mvp-v1\`, plus \`downloadState: "not-downloaded"\`.

Declare exactly these features:

| key | unit | formula |
|---|---|---|
| \`median_slope_deg\` | degrees | median of slope derived from clipped DEM |
| \`terrain_roughness_m\` | m | standard deviation of elevation in a 3 km local window |
| \`relative_relief_m\` | m | local maximum minus local minimum elevation in a 3 km window |

Add concrete preparation steps: authenticate to Earthdata, download only intersecting tiles, write source URL/timestamp/SHA-256 to \`data/training/raw/source-checksums.json\`, clip/mask no-data values, derive all three features, then fit body-specific transforms.

- [ ] **Step 4: Write the handoff README**

Document file roles, the command \`node --test pipeline/tests/training-catalog.test.mjs\`, Earthdata authentication, and the hard rule that only a later validated integrator handoff can create \`public/data/demo/\` assets.

- [ ] **Step 5: Verify GREEN**

Run: \`node --test pipeline/tests/training-catalog.test.mjs\`

Expected: all tests pass; result reports exactly 2 datasets, 1 Mars scenario, and 5 Earth candidates.

- [ ] **Step 6: Verify JSON and public isolation**

Run: \`Get-ChildItem data/training -Filter *.json | ForEach-Object { Get-Content -Raw $_ | ConvertFrom-Json | Out-Null }; rg -n 'public/' data/training\`

Expected: JSON parsing succeeds; search finds no output path below \`public/\`.

- [ ] **Step 7: Commit and inspect**

\`\`\`bash
git add data/training/preparation-manifest.json data/training/README.md pipeline/tests/training-catalog.test.mjs
git commit -m "docs: define MVP training data preparation"
git diff --check HEAD~3..HEAD
git status --short
\`\`\`

Expected: no whitespace errors and a clean working tree.
