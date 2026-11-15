import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildProductionSeed } from '../../scripts/build-production-seed.mjs';
import { validateProductionEvidence } from '../../scripts/validate-production-evidence.mjs';

const trainingRoot = new URL('../../data/training/', import.meta.url);

async function loadJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, trainingRoot), 'utf8'));
}

async function loadValidInput() {
  const [datasets, locations, manifest, features, rankings, contributions, evidence, validation] = await Promise.all([
    loadJson('datasets.json'),
    loadJson('locations.json'),
    loadJson('processed/2026-11-14-mvp-v1/model_manifest.json'),
    loadJson('processed/2026-11-14-mvp-v1/location-features.json'),
    loadJson('processed/2026-11-14-mvp-v1/rankings.json'),
    loadJson('processed/2026-11-14-mvp-v1/ranking-contributions.json'),
    loadJson('processed/2026-11-14-mvp-v1/location-evidence.json'),
    loadJson('processed/2026-11-14-mvp-v1/validation-report.json'),
  ]);

  return {
    datasets: datasets.datasets,
    locations: locations.locations,
    manifest,
    features: features.features,
    rankings: rankings.rankings,
    contributions: contributions.contributions,
    evidence: evidence.evidence,
    validation,
  };
}

test('accepts the complete MVP production evidence package', async () => {
  const result = validateProductionEvidence(await loadValidInput());

  assert.deepEqual(result, {
    datasetCount: 2,
    rankingCount: 5,
    contributionCount: 15,
    evidenceCount: 5,
    modelRunId: '2026-11-14-mvp-v1',
  });
});

test('rejects a ranking without source dataset IDs', async () => {
  const input = await loadValidInput();
  input.rankings[0].sourceDatasetIds = [];

  assert.throws(
    () => validateProductionEvidence(input),
    /source dataset IDs/,
  );
});

test('rejects a candidate without a limitation statement', async () => {
  const input = await loadValidInput();
  input.evidence[0].limitations = [];

  assert.throws(
    () => validateProductionEvidence(input),
    /limitation/,
  );
});

test('builds a compact production seed without raw-data references', async () => {
  const outputPath = join(await mkdtemp(join(tmpdir(), 'terra-seed-')), '0003_production_seed.sql');

  await buildProductionSeed({
    trainingRoot: new URL('../../data/training/', import.meta.url),
    outputPath,
  });

  const sql = await readFile(outputPath, 'utf8');
  assert.match(sql, /mars-mola-megdr-v2/);
  assert.match(sql, /earth-nasadem-hgt-v001/);
  assert.match(sql, /2026-11-14-mvp-v1/);
  assert.match(sql, /earth-mauna-kea-hawaii-v1/);
  const maunaKeaScore = sql
    .split("\n")
    .find((line) => line.includes("candidate_scores") && line.includes("earth-mauna-kea-hawaii-v1"));
  assert.ok(maunaKeaScore, "Mauna Kea production score should be seeded.");
  assert.match(maunaKeaScore, /median_slope_deg, terrain_roughness_m, relative_relief_m/);
  assert.match(maunaKeaScore, /7\.047629740447329/);
  assert.doesNotMatch(sql, /source-checksums|study-population-features|raw\//);
});
