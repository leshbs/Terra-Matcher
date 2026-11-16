import assert from "node:assert/strict";
import test from "node:test";

import { validateProductionContext } from "../../lib/scenario-production.ts";

const validContext = {
  scenario: {
    id: "mars-gale-aeolis-palus-v1",
    name: "Gale Crater / Aeolis Palus reference window",
    body: "mars",
    description: "Reference terrain window.",
    data_mode: "production",
  },
  modelRun: {
    id: "2026-11-14-mvp-v1",
    status: "ready",
    analysis_resolution_m: 500,
    local_window_km: 3,
    transformation_version: "ecdf-midrank-v1",
    input_dataset_ids: ["earth-nasadem-hgt-v001", "mars-mola-megdr-v2"],
  },
  candidateScores: Array.from({ length: 5 }, (_, index) => ({ model_run_id: "2026-11-14-mvp-v1", candidate_id: `candidate-${index + 1}`, rank: index + 1 })),
  contributions: Array.from({ length: 5 }, (_, candidateIndex) =>
    Array.from({ length: 3 }, (_, featureIndex) => ({ model_run_id: "2026-11-14-mvp-v1", candidate_id: `candidate-${candidateIndex + 1}`, feature_key: `feature-${featureIndex}` })),
  ).flat(),
  evidence: [],
  locationProfiles: [{ location_kind: "scenario", location_id: "mars-gale-aeolis-palus-v1" }, ...Array.from({ length: 5 }, (_, index) => ({ location_kind: "candidate", location_id: `candidate-${index + 1}` }))],
  datasets: [],
};

test("rejects a fixture scenario in the production repository", () => {
  const fixture = structuredClone(validContext);
  fixture.scenario.data_mode = "fixture";

  assert.throws(
    () => validateProductionContext(fixture),
    /fixture scenario is not production data/i,
  );
});

test("rejects a model run that is not ready", () => {
  const draft = structuredClone(validContext);
  draft.modelRun.status = "draft";

  assert.throws(
    () => validateProductionContext(draft),
    /model run is not ready/i,
  );
});

test("accepts a production context with one ready model run", () => {
  assert.equal(
    validateProductionContext(validContext).modelRun.status,
    "ready",
  );
});
