import test from 'node:test';
import assert from 'node:assert/strict';
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
