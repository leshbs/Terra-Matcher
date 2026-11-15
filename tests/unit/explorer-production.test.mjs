import assert from "node:assert/strict";
import test from "node:test";

import { buildExplorerContext } from "../../lib/explore/production.ts";

test("maps a production window and ranking row into the Explorer assembler context", () => {
  const context = buildExplorerContext({
    scenario: { id: "mars-gale-aeolis-palus-v1" },
    modelRun: { id: "2026-11-14-mvp-v1" },
    windows: [{
      id: "earth-mauna-kea-hawaii-v1", scenario_id: "mars-gale-aeolis-palus-v1", candidate_id: "earth-mauna-kea-hawaii-v1",
      model_run_id: "2026-11-14-mvp-v1", body: "earth", name: "Mauna Kea", kind: "candidate", center_longitude: -155.4681,
      center_latitude: 19.8207, dataset_id: "earth-nasadem-hgt-v001", operational_hypothesis: "Hypothesis.", limitations: ["Limit."],
      median_slope_deg: 7.05, terrain_roughness_m: 124.72, relative_relief_m: 492,
    }],
    scores: [{ candidate_id: "earth-mauna-kea-hawaii-v1", model_version: "ecdf-midrank-v1", rank: 1, similarity_score: 97.36, data_coverage: 1 }],
    contributions: [
      { candidate_id: "earth-mauna-kea-hawaii-v1", feature_key: "median_slope_deg", weighted_contribution: 0.0056, candidate_raw_value: 7.05, reference_raw_value: 2.44 },
      { candidate_id: "earth-mauna-kea-hawaii-v1", feature_key: "terrain_roughness_m", weighted_contribution: 0.0112, candidate_raw_value: 124.72, reference_raw_value: 44.48 },
      { candidate_id: "earth-mauna-kea-hawaii-v1", feature_key: "relative_relief_m", weighted_contribution: 0.0096, candidate_raw_value: 492, reference_raw_value: 184 },
    ],
    datasets: [{ id: "earth-nasadem-hgt-v001", provider: "NASA", product: "NASADEM", version: "V001", native_resolution: { value: 30 }, unit: "m", citation: "Citation", limitations: ["Limit."] }],
  });

  assert.equal(context.modelRun.modelVersion, "ecdf-midrank-v1");
  assert.equal(context.windows[0].rank, 1);
  assert.equal(context.windows[0].features.rough, 124.72);
});

test("rejects a candidate Explorer window without a matching score", () => {
  assert.throws(() => buildExplorerContext({ scenario: { id: "scenario" }, modelRun: { id: "run" }, windows: [{ id: "candidate", scenario_id: "scenario", candidate_id: "candidate", model_run_id: "run", body: "earth", name: "Candidate", kind: "candidate", center_longitude: 0, center_latitude: 0, dataset_id: "dataset", operational_hypothesis: "Hypothesis.", limitations: ["Limit."], median_slope_deg: 1, terrain_roughness_m: 1, relative_relief_m: 1 }], scores: [], contributions: [], datasets: [] }), /score/i);
});
