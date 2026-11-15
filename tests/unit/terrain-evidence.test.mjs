import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEvidenceBackedRanking } from '../../lib/terrain-evidence.ts';

const candidate = {
  id: 'earth-mauna-kea-hawaii-v1',
  name: "Mauna Kea, Hawai'i candidate window",
  country: null,
  latitude: 19.8207,
  longitude: -155.4681,
  source: 'See dataset provenance and candidate evidence.',
};

const validRanking = {
  modelRunId: '2026-11-14-mvp-v1',
  modelVersion: 'ecdf-midrank-v1',
  scenarioId: 'mars-gale-aeolis-palus-v1',
  candidateId: candidate.id,
  similarityScore: 97.36,
  rank: 1,
  dataCoverage: 1,
  sourceDatasetIds: ['earth-nasadem-hgt-v001', 'mars-mola-megdr-v2'],
  candidate,
  contributions: [
    { featureKey: 'median_slope_deg', available: true, normalizedWeight: 0.35, weightedContribution: 0.0056 },
    { featureKey: 'terrain_roughness_m', available: true, normalizedWeight: 0.35, weightedContribution: 0.0112 },
    { featureKey: 'relative_relief_m', available: true, normalizedWeight: 0.3, weightedContribution: 0.0096 },
  ],
  evidence: {
    operationalHypothesis: 'Volcanic highland terrain for rover traversal hypotheses.',
    limitations: ['Not mission-site approval.'],
    sourceDatasetIds: ['earth-nasadem-hgt-v001', 'mars-mola-megdr-v2'],
  },
};

test('accepts a complete evidence-backed production ranking', () => {
  assert.equal(parseEvidenceBackedRanking(validRanking).rank, 1);
});

test('rejects a production ranking without a limitation', () => {
  const invalid = structuredClone(validRanking);
  invalid.evidence.limitations = [];

  assert.throws(() => parseEvidenceBackedRanking(invalid), /limitation/i);
});
