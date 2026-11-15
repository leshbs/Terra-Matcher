import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateProductionEvidence } from './validate-production-evidence.mjs';

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

async function loadJson(root, relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), 'utf8'));
}

async function loadInput(trainingRoot) {
  const root = trainingRoot instanceof URL ? fileURLToPath(trainingRoot) : trainingRoot;
  const runRoot = 'processed/2026-11-14-mvp-v1';
  const [datasets, locations, manifest, features, rankings, contributions, evidence, validation] = await Promise.all([
    loadJson(root, 'datasets.json'),
    loadJson(root, 'locations.json'),
    loadJson(root, `${runRoot}/model_manifest.json`),
    loadJson(root, `${runRoot}/location-features.json`),
    loadJson(root, `${runRoot}/rankings.json`),
    loadJson(root, `${runRoot}/ranking-contributions.json`),
    loadJson(root, `${runRoot}/location-evidence.json`),
    loadJson(root, `${runRoot}/validation-report.json`),
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

function insert(table, columns, values, conflict) {
  return `insert into public.${table} (${columns.join(', ')}) values (${values.join(', ')}) on conflict ${conflict};`;
}

const requiredFeatureKeys = [
  'median_slope_deg',
  'terrain_roughness_m',
  'relative_relief_m',
];

function indexFeatureValues(features) {
  const valuesByLocation = new Map();

  for (const feature of features) {
    if (!requiredFeatureKeys.includes(feature.featureKey)) continue;
    const values = valuesByLocation.get(feature.locationId) ?? {};
    values[feature.featureKey] = feature.rawValue;
    valuesByLocation.set(feature.locationId, values);
  }

  return valuesByLocation;
}

function rawValuesForCandidate(valuesByLocation, candidateLocationId) {
  const values = valuesByLocation.get(candidateLocationId);
  if (!values || requiredFeatureKeys.some((key) => !Number.isFinite(values[key]))) {
    throw new Error(`Missing raw terrain features for candidate: ${candidateLocationId}`);
  }
  return values;
}

export async function buildProductionSeed({ trainingRoot, outputPath }) {
  const input = await loadInput(trainingRoot);
  validateProductionEvidence(input);
  const featureValuesByLocation = indexFeatureValues(input.features);

  const lines = ['begin;'];
  for (const dataset of input.datasets) {
    lines.push(insert('datasets', [
      'id', 'provider', 'product', 'version', 'url', 'access_url', 'native_resolution', 'unit', 'citation', 'limitations',
    ], [
      sqlString(dataset.id), sqlString(dataset.provider), sqlString(dataset.product), sqlString(dataset.version),
      sqlString(dataset.url), sqlString(dataset.accessUrl), sqlJson(dataset.nativeResolution), sqlString(dataset.unit),
      sqlString(dataset.citation), sqlJson(dataset.limitations),
    ], '(id) do update set provider = excluded.provider, product = excluded.product, version = excluded.version, url = excluded.url, access_url = excluded.access_url, native_resolution = excluded.native_resolution, unit = excluded.unit, citation = excluded.citation, limitations = excluded.limitations'));
  }

  lines.push(insert('model_runs', ['id', 'analysis_resolution_m', 'local_window_km', 'transformation_version', 'input_dataset_ids'], [
    sqlString(input.manifest.modelRunId), input.manifest.analysisResolutionM ?? 500, input.manifest.localWindowKm, sqlString(input.manifest.transformationVersion), sqlJson(input.manifest.inputDatasetIds),
  ], '(id) do update set analysis_resolution_m = excluded.analysis_resolution_m, local_window_km = excluded.local_window_km, transformation_version = excluded.transformation_version, input_dataset_ids = excluded.input_dataset_ids'));

  for (const location of input.locations) {
    if (location.kind === 'reference-scenario') {
      lines.push(insert('scenarios', ['id', 'name', 'body', 'description', 'data_mode'], [
        sqlString(location.id), sqlString(location.name), sqlString(location.body), sqlString('Data-derived terrain reference window; not a mission-site recommendation.'), sqlString('production'),
      ], '(id) do update set name = excluded.name, body = excluded.body, description = excluded.description, data_mode = excluded.data_mode'));
    } else {
      lines.push(insert('candidates', ['id', 'name', 'country', 'latitude', 'longitude', 'source'], [
        sqlString(location.id), sqlString(location.name), 'null', location.center.latitude, location.center.longitude, sqlString('See dataset provenance and candidate evidence.'),
      ], '(id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude, source = excluded.source'));
    }
  }

  for (const ranking of input.rankings) {
    const rawValues = rawValuesForCandidate(featureValuesByLocation, ranking.candidateLocationId);
    lines.push(insert('candidate_scores', ['model_run_id', 'model_version', 'scenario_id', 'candidate_id', 'median_slope_deg', 'terrain_roughness_m', 'relative_relief_m', 'similarity_score', 'rank', 'data_coverage', 'source_dataset_ids', 'generated_at'], [
      sqlString(ranking.modelRunId), sqlString(input.manifest.transformationVersion), sqlString(ranking.referenceLocationId), sqlString(ranking.candidateLocationId), rawValues.median_slope_deg, rawValues.terrain_roughness_m, rawValues.relative_relief_m, ranking.similarityScore, ranking.rank, ranking.dataCoverage, sqlJson(ranking.sourceDatasetIds), 'now()',
    ], '(model_run_id, scenario_id, candidate_id) do update set model_version = excluded.model_version, median_slope_deg = excluded.median_slope_deg, terrain_roughness_m = excluded.terrain_roughness_m, relative_relief_m = excluded.relative_relief_m, similarity_score = excluded.similarity_score, rank = excluded.rank, data_coverage = excluded.data_coverage, source_dataset_ids = excluded.source_dataset_ids, generated_at = excluded.generated_at'));
  }

  for (const contribution of input.contributions) {
    lines.push(insert('ranking_contributions', ['model_run_id', 'scenario_id', 'candidate_id', 'feature_key', 'available', 'normalized_weight', 'weighted_contribution', 'feature_distance', 'candidate_raw_value', 'reference_raw_value'], [
      sqlString(contribution.modelRunId), sqlString(contribution.referenceLocationId), sqlString(contribution.candidateLocationId), sqlString(contribution.featureKey), contribution.available, contribution.normalizedWeight, contribution.weightedContribution, contribution.featureDistance, contribution.candidateRawValue, contribution.referenceRawValue,
    ], '(model_run_id, scenario_id, candidate_id, feature_key) do update set available = excluded.available, normalized_weight = excluded.normalized_weight, weighted_contribution = excluded.weighted_contribution, feature_distance = excluded.feature_distance, candidate_raw_value = excluded.candidate_raw_value, reference_raw_value = excluded.reference_raw_value'));
  }

  for (const item of input.evidence) {
    lines.push(insert('location_evidence', ['model_run_id', 'location_id', 'operational_hypothesis', 'limitations', 'source_dataset_ids'], [
      sqlString(item.modelRunId), sqlString(item.locationId), sqlString(item.operationalHypothesis), sqlJson(item.limitations), sqlJson(item.sourceDatasetIds),
    ], '(model_run_id, location_id) do update set operational_hypothesis = excluded.operational_hypothesis, limitations = excluded.limitations, source_dataset_ids = excluded.source_dataset_ids'));
  }

  lines.push('commit;');
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argumentsByName = new Map(process.argv.slice(2).reduce((entries, value, index, values) => value.startsWith('--') ? [...entries, [value, values[index + 1]]] : entries, []));
  const trainingRoot = argumentsByName.get('--training-root');
  const outputPath = argumentsByName.get('--output');
  if (!trainingRoot || !outputPath) throw new Error('Usage: node scripts/build-production-seed.mjs --training-root <path> --output <path>');
  await buildProductionSeed({ trainingRoot, outputPath });
}
