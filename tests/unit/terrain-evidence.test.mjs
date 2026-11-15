import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductionCandidates, parseEvidenceBackedRanking } from '../../lib/terrain-evidence.ts';
import { buildMethodologyResponse } from '../../lib/methodology.ts';

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

test('builds production candidates only when every score has evidence', () => {
  const candidates = buildProductionCandidates(
    [{
      model_run_id: validRanking.modelRunId,
      model_version: validRanking.modelVersion,
      scenario_id: validRanking.scenarioId,
      candidate_id: validRanking.candidateId,
      similarity_score: validRanking.similarityScore,
      rank: validRanking.rank,
      data_coverage: validRanking.dataCoverage,
      source_dataset_ids: validRanking.sourceDatasetIds,
      candidates: validRanking.candidate,
    }],
    validRanking.contributions.map((item) => ({
      model_run_id: validRanking.modelRunId,
      scenario_id: validRanking.scenarioId,
      candidate_id: validRanking.candidateId,
      feature_key: item.featureKey,
      available: item.available,
      normalized_weight: item.normalizedWeight,
      weighted_contribution: item.weightedContribution,
    })),
    [{
      model_run_id: validRanking.modelRunId,
      location_id: validRanking.candidateId,
      operational_hypothesis: validRanking.evidence.operationalHypothesis,
      limitations: validRanking.evidence.limitations,
      source_dataset_ids: validRanking.evidence.sourceDatasetIds,
    }],
  );

  assert.equal(candidates[0].evidence.operationalHypothesis, validRanking.evidence.operationalHypothesis);
});

test('builds methodology only with both registered datasets', () => {
  const result = buildMethodologyResponse(
    {
      id: '2026-11-14-mvp-v1',
      analysis_resolution_m: 500,
      local_window_km: 3,
      transformation_version: 'ecdf-midrank-v1',
      input_dataset_ids: ['earth-nasadem-hgt-v001', 'mars-mola-megdr-v2'],
    },
    [
      { id: 'earth-nasadem-hgt-v001', provider: 'NASA EOSDIS', product: 'NASADEM', version: 'V001', url: 'https://example.com', access_url: 'https://example.com/data', native_resolution: { value: 1 }, unit: 'm', citation: 'Citation', limitations: ['Datum differs.'] },
      { id: 'mars-mola-megdr-v2', provider: 'NASA PDS', product: 'MOLA', version: '2.0', url: 'https://example.com', access_url: 'https://example.com/data', native_resolution: { value: 128 }, unit: 'm', citation: 'Citation', limitations: ['Interpolation exists.'] },
    ],
  );

  assert.equal(result.datasets.length, 2);
  assert.equal(result.modelRun.analysisResolutionM, 500);
});
