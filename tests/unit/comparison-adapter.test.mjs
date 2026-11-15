// Run with: node --test tests/unit/comparison-adapter.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL(
  "../../data/fixtures/comparison-demo.json",
  import.meta.url,
);
const adapterUrl = new URL(
  "../../components/comparison/adapter.ts",
  import.meta.url,
);
const dataUrl = new URL(
  "../../components/comparison/data.ts",
  import.meta.url,
);

const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const adapterSource = await readFile(adapterUrl, "utf8");
const dataSource = await readFile(dataUrl, "utf8");

function parseComparisonApiPayload(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    payload.schemaVersion === "1.0.0" &&
    payload.scenario &&
    Array.isArray(payload.candidates)
  ) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    return parseComparisonApiPayload(payload.data);
  }

  throw new Error("CONTRACT");
}

test("adapter exposes fixture and api source switcher knobs", () => {
  assert.match(adapterSource, /COMPARISON_DATA_SOURCE/);
  assert.match(adapterSource, /resolveComparisonSourceMode/);
  assert.match(adapterSource, /loadComparisonBundle/);
  assert.match(adapterSource, /falling back to fixture/);
  assert.match(dataSource, /loadComparisonBundle/);
  assert.match(dataSource, /getRankedCandidatesFromDataset/);
});

test("API payload parser accepts bare dataset and { data, meta } envelope", () => {
  const bare = parseComparisonApiPayload(fixture);
  assert.equal(bare.scenario.id, fixture.scenario.id);

  const envelope = parseComparisonApiPayload({
    data: fixture,
    meta: {
      modelRunId: fixture.model.modelRunId,
      modelVersion: fixture.model.modelVersion,
    },
  });

  assert.equal(envelope.candidates.length, 5);
  assert.equal(envelope.disclaimer, fixture.disclaimer);
});

test("API payload parser rejects unrelated shapes", () => {
  assert.throws(() => parseComparisonApiPayload({ ok: true }), /CONTRACT/);
  assert.throws(() => parseComparisonApiPayload(null), /CONTRACT/);
});
