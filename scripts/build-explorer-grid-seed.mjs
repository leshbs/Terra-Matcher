import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GRID_SAMPLE_COUNT = 25;

function assertFiniteNonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number.`);
  }
}

export function validateExplorerMapArtifact(input) {
  if (!input || !Array.isArray(input.windows) || !Array.isArray(input.samples)) {
    throw new Error("Explorer artifact must contain windows and samples arrays.");
  }

  const windowsById = new Map();
  for (const window of input.windows) {
    if (!window.id || !window.scenarioId || !window.modelRunId) {
      throw new Error("Explorer window is missing an identifier.");
    }
    if (windowsById.has(window.id)) {
      throw new Error(`Duplicate Explorer window: ${window.id}.`);
    }
    windowsById.set(window.id, window);
  }

  const samplesByWindow = new Map();
  const offsetsByWindow = new Map();
  for (const sample of input.samples) {
    const window = windowsById.get(sample.windowId);
    if (!window) throw new Error(`Explorer sample references an unknown window: ${sample.windowId}.`);
    if (sample.modelRunId !== window.modelRunId) {
      throw new Error(`Explorer sample model run does not match window ${sample.windowId}.`);
    }
    if (!sample.datasetId || sample.qualityFlag !== "source-backed-derived") {
      throw new Error(`Explorer sample ${sample.windowId} lacks source-backed provenance.`);
    }
    for (const field of ["offsetEastKm", "offsetNorthKm", "slope", "roughness", "relativeRelief"]) {
      assertFiniteNonNegative(Math.abs(sample[field]), field);
    }
    const offsets = offsetsByWindow.get(sample.windowId) ?? new Set();
    const offsetKey = `${sample.offsetEastKm}:${sample.offsetNorthKm}`;
    if (offsets.has(offsetKey)) throw new Error(`Duplicate Explorer sample offset for ${sample.windowId}.`);
    offsets.add(offsetKey);
    offsetsByWindow.set(sample.windowId, offsets);
    const group = samplesByWindow.get(sample.windowId) ?? [];
    group.push(sample);
    samplesByWindow.set(sample.windowId, group);
  }

  for (const window of input.windows) {
    if ((samplesByWindow.get(window.id) ?? []).length !== GRID_SAMPLE_COUNT) {
      throw new Error(`Explorer window ${window.id} must contain exactly ${GRID_SAMPLE_COUNT} samples.`);
    }
  }

  return { windows: input.windows, samples: input.samples };
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildExplorerMapSeed(input) {
  const artifact = validateExplorerMapArtifact(input);
  const runIds = new Set(artifact.windows.map((window) => window.modelRunId));
  if (runIds.size !== 1) throw new Error("Explorer seed must contain one model run.");
  const [modelRunId] = runIds;
  const lines = ["begin;"];

  for (const window of artifact.windows) {
    const candidateId = window.candidateId ?? null;
    const body = window.body ?? (candidateId ? "earth" : "mars");
    const kind = window.kind ?? (candidateId ? "candidate" : "reference-scenario");
    const longitude = window.longitude ?? 0;
    const latitude = window.latitude ?? 0;
    const datasetId = window.datasetId ?? "mars-mola-megdr-v2";
    const limitations = JSON.stringify(window.limitations ?? ["Data-derived terrain similarity, not mission-site approval."]);
    lines.push(
      "insert into public.explorer_windows (id, scenario_id, candidate_id, model_run_id, body, name, kind, center_longitude, center_latitude, radius_km, dataset_id, operational_hypothesis, limitations, median_slope_deg, terrain_roughness_m, relative_relief_m) values (" +
      [window.id, window.scenarioId, candidateId, window.modelRunId, body, window.name ?? window.id, kind, longitude, latitude, window.radiusKm ?? 20, datasetId, window.operationalHypothesis ?? "Production terrain window."].map(sql).concat(`${sql(limitations)}::jsonb`, [window.slope ?? 0, window.roughness ?? 0, window.relativeRelief ?? 0].map(sql)).join(", ") +
      ") on conflict (id) do update set model_run_id = excluded.model_run_id, center_longitude = excluded.center_longitude, center_latitude = excluded.center_latitude, median_slope_deg = excluded.median_slope_deg, terrain_roughness_m = excluded.terrain_roughness_m, relative_relief_m = excluded.relative_relief_m;",
    );
  }

  for (const sample of artifact.samples) {
    lines.push(
      "insert into public.explorer_grid_samples (id, window_id, model_run_id, dataset_id, offset_east_km, offset_north_km, slope, roughness, relative_relief, quality_flag) values (" +
      [sample.id ?? `${sample.windowId}:e${sample.offsetEastKm}n${sample.offsetNorthKm}`, sample.windowId, sample.modelRunId, sample.datasetId, sample.offsetEastKm, sample.offsetNorthKm, sample.slope, sample.roughness, sample.relativeRelief, sample.qualityFlag].map(sql).join(", ") +
      ") on conflict (id) do update set slope = excluded.slope, roughness = excluded.roughness, relative_relief = excluded.relative_relief, quality_flag = excluded.quality_flag;",
    );
  }

  const scenarioId = artifact.windows[0].scenarioId;
  lines.push(
    "update public.explorer_windows as map_window set median_slope_deg = score.median_slope_deg, terrain_roughness_m = score.terrain_roughness_m, relative_relief_m = score.relative_relief_m from public.candidate_scores as score where map_window.scenario_id = score.scenario_id and map_window.model_run_id = score.model_run_id and map_window.candidate_id = score.candidate_id and map_window.candidate_id is not null;",
    `update public.explorer_windows as map_window set median_slope_deg = reference.slope, terrain_roughness_m = reference.roughness, relative_relief_m = reference.relief from (select max(reference_raw_value) filter (where feature_key = 'median_slope_deg') as slope, max(reference_raw_value) filter (where feature_key = 'terrain_roughness_m') as roughness, max(reference_raw_value) filter (where feature_key = 'relative_relief_m') as relief from public.ranking_contributions where scenario_id = ${sql(scenarioId)} and model_run_id = ${sql(modelRunId)}) as reference where map_window.scenario_id = ${sql(scenarioId)} and map_window.model_run_id = ${sql(modelRunId)} and map_window.candidate_id is null;`,
  );
  lines.push(`update public.model_runs set status = 'ready' where id = ${sql(modelRunId)};`);
  lines.push("commit;");
  return lines.join("\n");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function buildArtifactFromLayers({ markers, cells, locations }) {
  const locationById = new Map(locations.locations.map((location) => [location.id, location]));
  const windows = markers.features.map((marker) => {
    const properties = marker.properties ?? {};
    const location = locationById.get(properties.id);
    if (!location || marker.geometry?.type !== "Point") {
      throw new Error(`Layer marker is missing a registered location: ${properties.id ?? "unknown"}.`);
    }
    if (properties.modelRunId === undefined || !Array.isArray(properties.datasetIds) || properties.datasetIds.length !== 1) {
      throw new Error(`Layer marker ${properties.id} has incomplete production provenance.`);
    }
    return {
      id: properties.id,
      scenarioId: "mars-gale-aeolis-palus-v1",
      candidateId: properties.kind === "candidate" ? properties.id : null,
      modelRunId: properties.modelRunId,
      body: properties.body,
      name: properties.name,
      kind: properties.kind,
      longitude: marker.geometry.coordinates[0],
      latitude: marker.geometry.coordinates[1],
      radiusKm: location.radiusKm,
      datasetId: properties.datasetIds[0],
      operationalHypothesis: location.operationalHypothesis,
      limitations: location.limitations,
    };
  });
  const markerIds = new Set(windows.map((window) => window.id));
  const samples = cells.features.map((cell) => {
    const properties = cell.properties ?? {};
    if (!markerIds.has(properties.wid)) throw new Error(`Terrain cell references unknown window: ${properties.wid ?? "unknown"}.`);
    const window = windows.find((entry) => entry.id === properties.wid);
    return {
      id: properties.id,
      windowId: properties.wid,
      modelRunId: window.modelRunId,
      datasetId: window.datasetId,
      offsetEastKm: properties.e,
      offsetNorthKm: properties.n,
      slope: properties.slope,
      roughness: properties.rough,
      relativeRelief: properties.relief,
      qualityFlag: "source-backed-derived",
    };
  });
  return validateExplorerMapArtifact({ windows, samples });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.cwd());
  const artifact = buildArtifactFromLayers({
    markers: readJson(resolve(root, "public/layers/candidates.geojson")),
    cells: readJson(resolve(root, "public/layers/terrain-cells.geojson")),
    locations: readJson(resolve(root, "data/training/locations.json")),
  });
  writeFileSync(resolve(root, "supabase/seed/0004_explorer_map_seed.sql"), `${buildExplorerMapSeed(artifact)}\n`);
}
