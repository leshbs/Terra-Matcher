const requiredDatasetFields = [
  'id',
  'provider',
  'product',
  'version',
  'url',
  'accessUrl',
  'license',
  'nativeResolution',
  'unit',
  'citation',
  'accessedAt',
  'limitations',
];

export function validateTrainingCatalog({ datasets, locations, manifest }) {
  const datasetIds = new Set();

  for (const dataset of datasets) {
    for (const field of requiredDatasetFields) {
      if (!dataset[field] || (Array.isArray(dataset[field]) && dataset[field].length === 0)) {
        throw new Error(`dataset ${dataset.id ?? '<unknown>'} missing ${field}`);
      }
    }

    if (datasetIds.has(dataset.id)) {
      throw new Error(`duplicate dataset ID: ${dataset.id}`);
    }

    datasetIds.add(dataset.id);
  }

  if (String(manifest.outputRoot).startsWith('public/')) {
    throw new Error('public paths are not permitted for training output');
  }

  for (const location of locations) {
    const { latitude, longitude } = location.center ?? {};

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`invalid latitude: ${location.id}`);
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 360) {
      throw new Error(`invalid longitude: ${location.id}`);
    }

    for (const datasetId of location.datasetIds ?? []) {
      if (!datasetIds.has(datasetId)) {
        throw new Error(`unknown dataset ID: ${datasetId}`);
      }
    }

    if (location.kind === 'candidate') {
      for (const field of ['name', 'operationalHypothesis', 'limitations', 'status']) {
        if (!location[field] || (Array.isArray(location[field]) && location[field].length === 0)) {
          throw new Error(`candidate ${location.id} missing ${field}`);
        }
      }
    }
  }

  const marsScenarioCount = locations.filter(
    (location) => location.body === 'mars' && location.kind === 'reference-scenario',
  ).length;
  const earthCandidateCount = locations.filter(
    (location) => location.body === 'earth' && location.kind === 'candidate',
  ).length;

  if (marsScenarioCount !== 1) {
    throw new Error('catalog must contain exactly one Mars reference scenario');
  }

  if (earthCandidateCount !== 5 && earthCandidateCount !== 0) {
    throw new Error('catalog must contain exactly five Earth candidates');
  }

  const requiredFeatureKeys = ['median_slope_deg', 'terrain_roughness_m', 'relative_relief_m'];
  const featureKeys = (manifest.features ?? []).map((feature) => feature.key);

  if (featureKeys.length !== requiredFeatureKeys.length || !requiredFeatureKeys.every((key) => featureKeys.includes(key))) {
    throw new Error('manifest must declare the three required features');
  }

  for (const feature of manifest.features ?? []) {
    if (!feature.key || !feature.unit || feature.localWindowKm !== 3) {
      throw new Error(`invalid feature: ${feature.key ?? '<unknown>'}`);
    }
  }

  return { datasetCount: datasets.length, marsScenarioCount, earthCandidateCount };
}
