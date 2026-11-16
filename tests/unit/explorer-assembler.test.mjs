import assert from "node:assert/strict";
import test from "node:test";

import { assembleExplorerDataset } from "../../lib/explore/assembler.ts";
import { ExplorerApiEnvelopeSchema } from "../../lib/explore/contracts.ts";

const dataset = {
  id: "mars-mola-megdr-v2",
  short: "MOLA",
  provider: "NASA PDS",
  resolution: "463 m",
  unit: "metres",
  license: "CC0",
  citation: "MOLA MEGDR v2",
  limitations: ["Interpolated between orbital tracks."],
};

function samples(count = 25) {
  return Array.from({ length: count }, (_, index) => ({
    id: `mars-study-${index}`,
    modelRunId: "run-ready",
    windowId: "mars-study",
    datasetId: dataset.id,
    eastKm: (index % 5) * 4 - 8,
    northKm: Math.floor(index / 5) * 4 - 8,
    slope: index === 0 ? 1 : 9,
    roughness: index === 0 ? 10 : 50,
    relief: index === 0 ? 100 : 900,
  }));
}

function context(status = "ready") {
  return {
    scenario: { id: "scenario-1" },
    modelRun: { id: "run-ready", status, modelVersion: "ecdf-midrank-v1" },
    datasets: [dataset],
    windows: [{
      id: "mars-study",
      scenarioId: "scenario-1",
      name: "Gale reference",
      kind: "scenario",
      body: "mars",
      center: [137.4417, -4.5895],
      datasetId: dataset.id,
      hypothesis: "Reference only.",
      limitations: ["Not a landing-site recommendation."],
      features: { slope: 4, rough: 30, relief: 500 },
    }],
  };
}

function earthCandidateContext(overrides = {}) {
  const candidate = {
    ...context().windows[0],
    body: "earth",
    kind: "candidate",
    rank: 1,
    score: 0.82,
    coverage: 1,
    contributions: [
      { featureKey: "slope", candidateRaw: 4, referenceRaw: 4, weightedContribution: 0.1 },
      { featureKey: "rough", candidateRaw: 30, referenceRaw: 30, weightedContribution: 0.2 },
      { featureKey: "relief", candidateRaw: 500, referenceRaw: 500, weightedContribution: 0.3 },
    ],
    strongest: "slope",
    mismatch: "relief",
    ...overrides,
  };

  return { ...context(), windows: [candidate] };
}

test("assembles ready-run samples into local windows, cell geometry, ranges, and dataset metadata", () => {
  const result = assembleExplorerDataset(context(), samples());

  assert.equal(result.meta.modelRunId, "run-ready");
  assert.equal(result.meta.modelVersion, "ecdf-midrank-v1");
  assert.deepEqual(result.data.datasets[dataset.id], dataset);
  assert.equal(result.data.windows[0].points.length, 25);
  assert.deepEqual(result.data.windows[0].points[0], { e: -8, n: -8, slope: 1, rough: 10, relief: 100 });
  assert.equal(result.data.cells.features.length, 25);
  assert.equal(result.data.cells.features[0].geometry.type, "Polygon");
  assert.deepEqual(result.data.gridRanges, {
    slope: [1, 9],
    rough: [10, 50],
    relief: [100, 900],
  });
});

test("rejects samples when the selected model run is not ready", () => {
  assert.throws(
    () => assembleExplorerDataset(context("draft"), samples()),
    /model run is not ready/i,
  );
});

test("rejects a window without exactly 25 samples", () => {
  assert.throws(
    () => assembleExplorerDataset(context(), samples(24)),
    /exactly 25 samples/i,
  );
});

test("rejects a sample from another model run", () => {
  const wrongRunSamples = samples();
  wrongRunSamples[0].modelRunId = "another-run";

  assert.throws(
    () => assembleExplorerDataset(context(), wrongRunSamples),
    /does not match the selected model run/i,
  );
});

test("rejects a sample whose window is absent from the selected context", () => {
  const unknownWindowSamples = samples();
  unknownWindowSamples.push({ ...unknownWindowSamples[0], id: "orphan", windowId: "missing-window" });

  assert.throws(
    () => assembleExplorerDataset(context(), unknownWindowSamples),
    /does not belong to the selected explorer context/i,
  );
});

test("rejects an assembled payload containing non-finite runtime sample values", () => {
  const invalidSamples = samples();
  invalidSamples[0].slope = Number.NaN;

  assert.throws(
    () => assembleExplorerDataset(context(), invalidSamples),
    /invalid explorer api envelope/i,
  );
});

test("rejects Earth candidates without complete ranking and contribution evidence", () => {
  assert.throws(
    () => assembleExplorerDataset(earthCandidateContext({ contributions: undefined }), samples()),
    /invalid explorer api envelope/i,
  );
});

test("Explorer API envelope schema rejects malformed windows, cells, ranges, and non-production data", () => {
  const valid = assembleExplorerDataset(context(), samples());
  const malformedWindow = structuredClone(valid);
  malformedWindow.data.windows[0].points.pop();
  const malformedCell = structuredClone(valid);
  malformedCell.data.cells.features[0].geometry.coordinates[0].pop();
  const malformedRange = structuredClone(valid);
  malformedRange.data.gridRanges.slope = [9, 1];
  const fixtureEnvelope = structuredClone(valid);
  fixtureEnvelope.meta.dataMode = "fixture";

  for (const payload of [malformedWindow, malformedCell, malformedRange, fixtureEnvelope]) {
    assert.equal(ExplorerApiEnvelopeSchema.safeParse(payload).success, false);
  }
});

test("Explorer API envelope schema requires evidence per Earth candidate and validates window references", () => {
  const candidate = assembleExplorerDataset(earthCandidateContext(), samples());
  const missingCandidateScore = structuredClone(candidate);
  delete missingCandidateScore.data.windows[0].score;
  const incompleteCandidateEvidence = structuredClone(candidate);
  incompleteCandidateEvidence.data.windows[0].contributions.pop();
  const missingDataset = structuredClone(candidate);
  missingDataset.data.windows[0].datasetId = "missing-dataset";
  const cellsMissingOneWindow = structuredClone(candidate);
  cellsMissingOneWindow.data.windows.push({ ...cellsMissingOneWindow.data.windows[0], id: "second-window" });
  cellsMissingOneWindow.data.cells.features.push(...structuredClone(cellsMissingOneWindow.data.cells.features));

  for (const payload of [missingCandidateScore, incompleteCandidateEvidence, missingDataset, cellsMissingOneWindow]) {
    assert.equal(ExplorerApiEnvelopeSchema.safeParse(payload).success, false);
  }
});
