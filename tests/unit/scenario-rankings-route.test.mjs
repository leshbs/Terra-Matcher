import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../app/api/scenarios/[scenarioId]/rankings/route.ts", import.meta.url), "utf8");

test("rankings route delegates production data to repository and assembler", () => {
  assert.match(route, /loadProductionScenario/);
  assert.match(route, /assembleComparisonDataset/);
  assert.match(route, /dataMode: "production"/);
});

test("rankings route declares invalid ID, missing scenario, and provenance responses", () => {
  assert.match(route, /INVALID_SCENARIO_ID/);
  assert.match(route, /SCENARIO_NOT_FOUND/);
  assert.match(route, /INVALID_PROVENANCE/);
  assert.match(route, /Cache-Control/);
});
