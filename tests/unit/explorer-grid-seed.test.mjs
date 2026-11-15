import assert from "node:assert/strict";
import test from "node:test";

import { buildExplorerMapSeed, validateExplorerMapArtifact } from "../../scripts/build-explorer-grid-seed.mjs";

const runId = "2026-11-14-mvp-v1";

function samples(windowId) {
  return Array.from({ length: 25 }, (_, index) => ({
    windowId,
    modelRunId: runId,
    datasetId: "mars-mola-megdr-v2",
    offsetEastKm: index % 5,
    offsetNorthKm: Math.floor(index / 5),
    slope: 1,
    roughness: 2,
    relativeRelief: 3,
    qualityFlag: "source-backed-derived",
  }));
}

const windows = [
  {
    id: "mars-gale-aeolis-palus-v1",
    scenarioId: "mars-gale-aeolis-palus-v1",
    candidateId: null,
    modelRunId: runId,
  },
];

test("accepts a Mars reference window with exactly 25 samples", () => {
  assert.equal(validateExplorerMapArtifact({ windows, samples: samples(windows[0].id) }).samples.length, 25);
});

test("rejects an incomplete grid", () => {
  assert.throws(
    () => validateExplorerMapArtifact({ windows, samples: samples(windows[0].id).slice(1) }),
    /25 samples/i,
  );
});

test("rejects duplicate sample offsets", () => {
  const duplicate = samples(windows[0].id);
  duplicate[24] = { ...duplicate[24], offsetEastKm: 0, offsetNorthKm: 0 };
  assert.throws(
    () => validateExplorerMapArtifact({ windows, samples: duplicate }),
    /duplicate/i,
  );
});

test("builds idempotent SQL and marks its model run ready only after inserts", () => {
  const sql = buildExplorerMapSeed({ windows, samples: samples(windows[0].id) });
  assert.match(sql, /insert into public\.explorer_windows/i);
  assert.match(sql, /insert into public\.explorer_grid_samples/i);
  assert.doesNotMatch(sql, /explorer_windows as window\b/i);
  assert.match(sql, /explorer_windows as map_window\b/i);
  assert.ok(sql.lastIndexOf("insert into public.explorer_grid_samples") < sql.lastIndexOf("update public.model_runs set status = 'ready'"));
});
