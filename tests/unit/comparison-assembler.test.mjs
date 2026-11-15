import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

import { validateProductionContext } from "../../lib/scenario-production.ts";

const contractUrl = new URL("../../components/comparison/contracts.ts", import.meta.url).href;
const assemblerSource = await readFile(new URL("../../lib/comparison/assembler.ts", import.meta.url), "utf8");
const assemblerModule = await import(`data:text/javascript,${encodeURIComponent(
  stripTypeScriptTypes(assemblerSource, { mode: "transform" })
    .replace('import "server-only";\n', "")
    .replace('"@/components/comparison/contracts"', JSON.stringify(contractUrl)),
)}`);

const featureKeys = ["median_slope_deg", "terrain_roughness_m", "relative_relief_m"];
const weights = [0.35, 0.35, 0.3];

function profile(id, location_kind, latitude, longitude) {
  return {
    location_id: id, location_kind, latitude, longitude, radius_km: 3,
    summary: `${id} summary`, operational_hypothesis: `${id} hypothesis`,
    limitations: [`${id} limitation`], source_dataset_ids: ["terrain-v1"],
    analysis_resolution_m: 500, local_window_km: 3, quality_flag: "source-backed-derived",
    features: Object.fromEntries(featureKeys.map((key, index) => [key, {
      rawValue: index + 1, normalizedValue: 0.2 + index / 10,
      unit: key === "median_slope_deg" ? "degrees" : "m", sourceDatasetId: "terrain-v1",
    }])),
  };
}

function validContext() {
  const candidates = Array.from({ length: 5 }, (_, index) => `earth-${index + 1}`);
  return {
    scenario: { id: "mars-1", name: "Mars reference", body: "mars", description: null, data_mode: "production" },
    modelRun: { id: "run-1", status: "ready", analysis_resolution_m: 500, local_window_km: 3, transformation_version: "ecdf-v1", input_dataset_ids: ["terrain-v1"] },
    candidateScores: candidates.map((candidate_id, index) => ({ model_run_id: "run-1", candidate_id, rank: index + 1, similarity_score: 90, data_coverage: 1 })),
    contributions: candidates.flatMap((candidate_id) => featureKeys.map((feature_key, index) => ({ model_run_id: "run-1", candidate_id, feature_key, available: true, normalized_weight: weights[index], feature_distance: 0.1, weighted_contribution: weights[index] * 0.1 }))),
    evidence: candidates.map((location_id) => ({ location_id, largest_mismatch: { feature_key: "relative_relief_m" }, limitations: [`${location_id} evidence limitation`] })),
    locationProfiles: [profile("mars-1", "scenario", -4.5, 137.4), ...candidates.map((id, index) => profile(id, "candidate", index + 1, index + 2))],
    datasets: [{ id: "terrain-v1", provider: "NASA", product: "DEM", version: "1", url: "https://example.test/dem", citation: "Terrain DEM", native_resolution: { metres: 500 }, unit: "m" }],
  };
}

test("assembler preserves source-backed scenario and candidate records in the comparison contract", () => {
  const dataset = assemblerModule.assembleComparisonDataset(validContext());
  assert.equal(dataset.dataMode, "production");
  assert.equal(dataset.scenario.name, "Mars reference");
  assert.deepEqual(dataset.scenario.center, { latitude: -4.5, longitude: 137.4 });
  assert.equal(dataset.candidates.length, 5);
  assert.deepEqual(dataset.candidates[0].contributions.map(({ featureKey, weight }) => ({ featureKey, weight })), [
    { featureKey: "median_slope_deg", weight: 0.35 },
    { featureKey: "terrain_roughness_m", weight: 0.35 },
    { featureKey: "relative_relief_m", weight: 0.3 },
  ]);
  for (const [index, expected] of [0.035, 0.035, 0.03].entries()) {
    assert.ok(Math.abs(dataset.candidates[0].contributions[index].weightedContribution - expected) < 0.000001);
  }
  assert.deepEqual(dataset.candidates[0].mismatchPoints, ["relative_relief_m"]);
  assert.equal(dataset.datasets[0].nativeResolution, '{"metres":500}');
});

test("production context rejects an incomplete contribution set before mapping", () => {
  const context = validContext(); context.contributions.pop();
  assert.throws(() => validateProductionContext(context), /missing feature contributions/i);
});

test("assembler rejects a missing candidate profile instead of emitting malformed comparison data", () => {
  const context = validContext(); context.locationProfiles = context.locationProfiles.filter((item) => item.location_id !== "earth-5");
  assert.throws(() => assemblerModule.assembleComparisonDataset(context));
});
