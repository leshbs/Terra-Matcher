const REQUIRED_FEATURE_KEYS = new Set([
  'median_slope_deg',
  'terrain_roughness_m',
  'relative_relief_m',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = key(item);
    counts.set(value, [...(counts.get(value) ?? []), item]);
    return counts;
  }, new Map());
}

export function validateProductionEvidence({
  datasets,
  locations,
  manifest,
  features,
  rankings,
  contributions,
  evidence,
  validation,
}) {
  assert(validation?.status === 'passed', 'production validation status must be passed');
  assert(Array.isArray(datasets) && datasets.length === 2, 'expected two source datasets');
  assert(Array.isArray(locations) && locations.length === 6, 'expected one Mars scenario and five Earth candidates');
  assert(Array.isArray(features) && features.length === 18, 'expected eighteen display features');
  assert(Array.isArray(rankings) && rankings.length === 5, 'expected five rankings');
  assert(Array.isArray(contributions) && contributions.length === 15, 'expected fifteen contributions');
  assert(Array.isArray(evidence) && evidence.length === 5, 'expected five evidence records');

  const datasetIds = new Set(datasets.map((dataset) => dataset.id));
  const candidateLocations = new Map(
    locations
      .filter((location) => location.body === 'earth' && location.kind === 'candidate')
      .map((location) => [location.id, location]),
  );
  assert(candidateLocations.size === 5, 'expected five Earth candidate locations');

  const runId = manifest?.modelRunId;
  assert(runId === '2026-11-14-mvp-v1', 'unexpected model run ID');
  assert(validation.modelRunId === runId, 'validation report model run mismatch');

  const contributionsByCandidate = countBy(contributions, (item) => item.candidateLocationId);
  const evidenceByCandidate = new Map(evidence.map((item) => [item.locationId, item]));

  for (const ranking of rankings) {
    assert(ranking.modelRunId === runId, `ranking model run mismatch: ${ranking.candidateLocationId}`);
    assert(candidateLocations.has(ranking.candidateLocationId), `unknown ranking candidate: ${ranking.candidateLocationId}`);
    assert(ranking.dataCoverage === 1, `ranking coverage must be complete: ${ranking.candidateLocationId}`);
    assert(Array.isArray(ranking.sourceDatasetIds) && ranking.sourceDatasetIds.length === 2, `ranking requires two source dataset IDs: ${ranking.candidateLocationId}`);
    for (const datasetId of ranking.sourceDatasetIds) {
      assert(datasetIds.has(datasetId), `unknown source dataset ID: ${datasetId}`);
    }

    const candidateContributions = contributionsByCandidate.get(ranking.candidateLocationId) ?? [];
    assert(candidateContributions.length === 3, `ranking requires three contributions: ${ranking.candidateLocationId}`);
    assert(
      new Set(candidateContributions.map((item) => item.featureKey)).size === REQUIRED_FEATURE_KEYS.size &&
        candidateContributions.every((item) => REQUIRED_FEATURE_KEYS.has(item.featureKey)),
      `ranking contributions must cover the three required features: ${ranking.candidateLocationId}`,
    );
    assert(candidateContributions.every((item) => item.modelRunId === runId && item.available === true), `ranking has unavailable contribution: ${ranking.candidateLocationId}`);

    const candidateEvidence = evidenceByCandidate.get(ranking.candidateLocationId);
    assert(candidateEvidence?.modelRunId === runId, `missing evidence for candidate: ${ranking.candidateLocationId}`);
    assert(candidateEvidence.operationalHypothesis?.trim(), `missing operational hypothesis: ${ranking.candidateLocationId}`);
    assert(Array.isArray(candidateEvidence.limitations) && candidateEvidence.limitations.length > 0, `missing limitation statement: ${ranking.candidateLocationId}`);
    assert(Array.isArray(candidateEvidence.sourceDatasetIds) && candidateEvidence.sourceDatasetIds.length > 0, `missing evidence source dataset IDs: ${ranking.candidateLocationId}`);
  }

  return {
    datasetCount: datasets.length,
    rankingCount: rankings.length,
    contributionCount: contributions.length,
    evidenceCount: evidence.length,
    modelRunId: runId,
  };
}
