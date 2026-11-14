import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTrainingCatalog } from '../src/terra_analog/validate-training-catalog.mjs';

const valid = {
  datasets: [
    {
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
      limitations: ['Interpolated gaps exist between MOLA tracks.'],
    },
  ],
  locations: [
    {
      id: 'mars-gale-aeolis-palus-v1',
      kind: 'reference-scenario',
      body: 'mars',
      center: { latitude: -4.5895, longitude: 137.4417 },
      radiusKm: 20,
      datasetIds: ['mars-mola-megdr-v2'],
    },
  ],
  manifest: {
    outputRoot: 'data/training/processed/2026-11-14-mvp-v1',
    features: [
      { key: 'median_slope_deg', unit: 'degrees', localWindowKm: 3 },
      { key: 'terrain_roughness_m', unit: 'm', localWindowKm: 3 },
      { key: 'relative_relief_m', unit: 'm', localWindowKm: 3 },
    ],
  },
};

test('accepts a source-backed Mars scenario', () => {
  assert.deepEqual(validateTrainingCatalog(valid), {
    datasetCount: 1,
    marsScenarioCount: 1,
    earthCandidateCount: 0,
  });
});

test('rejects public output paths and orphan dataset references', () => {
  assert.throws(
    () => validateTrainingCatalog({ ...valid, manifest: { ...valid.manifest, outputRoot: 'public/data/demo' } }),
    /public/,
  );
  assert.throws(
    () => validateTrainingCatalog({ ...valid, locations: [{ ...valid.locations[0], datasetIds: ['missing'] }] }),
    /missing/,
  );
});

test('rejects incomplete candidates and incomplete feature contracts', () => {
  const candidate = {
    id: 'earth-example-v1',
    name: 'Example candidate',
    kind: 'candidate',
    body: 'earth',
    center: { latitude: 1, longitude: 1 },
    radiusKm: 20,
    datasetIds: ['mars-mola-megdr-v2'],
    limitations: ['Example limitation.'],
    status: 'planned-for-preparation',
  };
  const incompleteCandidates = Array.from({ length: 5 }, (_, index) => ({
    ...candidate,
    id: `earth-example-${index}-v1`,
  }));

  assert.throws(
    () => validateTrainingCatalog({ ...valid, locations: [valid.locations[0], ...incompleteCandidates] }),
    /operationalHypothesis/,
  );
  assert.throws(
    () => validateTrainingCatalog({ ...valid, manifest: { ...valid.manifest, features: valid.manifest.features.slice(0, 2) } }),
    /three required features/,
  );
});

const loadJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('dataset and location registries contain one Mars scenario and five Earth candidates', async () => {
  const [datasetDocument, locationDocument] = await Promise.all([
    loadJson('../../data/training/datasets.json'),
    loadJson('../../data/training/locations.json'),
  ]);

  assert.deepEqual(
    validateTrainingCatalog({
      datasets: datasetDocument.datasets,
      locations: locationDocument.locations,
      manifest: valid.manifest,
    }),
    { datasetCount: 2, marsScenarioCount: 1, earthCandidateCount: 5 },
  );
});

test('preparation manifest has exactly the three comparable features', async () => {
  const manifest = await loadJson('../../data/training/preparation-manifest.json');

  assert.equal(manifest.modelRunId, '2026-11-14-mvp-v1');
  assert.equal(manifest.rawRoot, 'data/training/raw');
  assert.equal(manifest.outputRoot.startsWith('public/'), false);
  assert.deepEqual(
    manifest.features.map((feature) => feature.key),
    ['median_slope_deg', 'terrain_roughness_m', 'relative_relief_m'],
  );
  assert.ok(manifest.features.every((feature) => feature.localWindowKm === 3));
});

test('complete committed catalog validates against its manifest', async () => {
  const [datasetDocument, locationDocument, manifest] = await Promise.all([
    loadJson('../../data/training/datasets.json'),
    loadJson('../../data/training/locations.json'),
    loadJson('../../data/training/preparation-manifest.json'),
  ]);

  assert.deepEqual(
    validateTrainingCatalog({
      datasets: datasetDocument.datasets,
      locations: locationDocument.locations,
      manifest,
    }),
    { datasetCount: 2, marsScenarioCount: 1, earthCandidateCount: 5 },
  );
});
