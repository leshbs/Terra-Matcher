import assert from "node:assert/strict";
import test from "node:test";

import { assembleExplorerDataset } from "../../lib/explore/assembler.ts";

const MODEL_RUN_ID = "2026-11-14-mvp-v1";

function gridSamples(windowId) {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `${windowId}-${index}`,
    windowId,
    modelRunId: MODEL_RUN_ID,
    eastKm: (index % 5) - 2,
    northKm: Math.floor(index / 5) - 2,
    slope: 7,
    roughness: 124,
    relief: 492,
  }));
}

const context = {
  scenario: { id: "mars-gale-aeolis-palus-v1", name: "Gale", body: "mars" },
  modelRun: { id: MODEL_RUN_ID, modelVersion: "ecdf-midrank-v1" },
  datasets: [{ id: "mars-mola-megdr-v2", short: "MOLA" }],
  windows: [
    {
      id: "mars-gale-aeolis-palus-v1",
      scenarioId: "mars-gale-aeolis-palus-v1",
      candidateId: null,
      body: "mars",
      name: "Gale",
      center: [137.4417, -4.5895],
      datasetId: "mars-mola-megdr-v2",
      hypothesis: "Reference window.",
      limitations: ["Not a mission-site recommendation."],
      features: { slope: 7, rough: 124, relief: 492 },
    },
  ],
};

test("builds a map dataset only when a window has exactly 25 samples", () => {
  const result = assembleExplorerDataset(context, gridSamples("mars-gale-aeolis-palus-v1"));
  assert.equal(result.meta.modelRunId, MODEL_RUN_ID);
  assert.equal(result.data.cells.features.length, 25);
  assert.equal(result.data.windows[0].pointCount, 25);
});

test("rejects samples from a different model run", () => {
  const samples = gridSamples("mars-gale-aeolis-palus-v1");
  samples[0].modelRunId = "wrong-run";
  assert.throws(() => assembleExplorerDataset(context, samples), /model run/i);
});
