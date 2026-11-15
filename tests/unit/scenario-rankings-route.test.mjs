import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const routeSource = await readFile(new URL("../../app/api/scenarios/[scenarioId]/rankings/route.ts", import.meta.url), "utf8");
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

async function loadRoute({ loadProductionScenario, assembleComparisonDataset }) {
  const nextServer = moduleUrl(`export async function connection() {}\nexport const NextResponse = { json(body, init = {}) { return new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } }); } };`);
  const loader = moduleUrl(`export const loadProductionScenario = ${loadProductionScenario};`);
  const assembler = moduleUrl(`export const assembleComparisonDataset = ${assembleComparisonDataset};`);
  const source = stripTypeScriptTypes(routeSource, { mode: "transform" })
    .replace('"next/server"', JSON.stringify(nextServer))
    .replace('"@/lib/comparison/assembler"', JSON.stringify(assembler))
    .replace('"@/lib/scenario-production"', JSON.stringify(loader));
  return import(moduleUrl(`${source}\n//# sourceURL=rankings-route-${Math.random()}.mjs`));
}

test("rankings route rejects malformed scenario IDs before loading production data", async () => {
  const route = await loadRoute({ loadProductionScenario: 'async () => { throw new Error("loader should not run"); }', assembleComparisonDataset: '() => { throw new Error("assembler should not run"); }' });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "bad/id" }) });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: { code: "INVALID_SCENARIO_ID", message: "Scenario ID is invalid." } });
});

test("rankings route maps unavailable provenance to its public error contract", async () => {
  const route = await loadRoute({ loadProductionScenario: 'async () => { throw new Error("Candidate ranking is missing feature contributions."); }', assembleComparisonDataset: '() => ({})' });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "mars-1" }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { code: "INVALID_PROVENANCE", message: "Production ranking is unavailable." } });
});

test("rankings route returns a production envelope with model metadata", async () => {
  const route = await loadRoute({ loadProductionScenario: 'async () => ({ id: "production-context" })', assembleComparisonDataset: '() => ({ schemaVersion: "1.0.0", dataMode: "production", model: { modelRunId: "run-9", modelVersion: "ecdf-v9" } })' });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "mars_1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { schemaVersion: "1.0.0", dataMode: "production", model: { modelRunId: "run-9", modelVersion: "ecdf-v9" } }, meta: { dataMode: "production", modelRunId: "run-9", modelVersion: "ecdf-v9" } });
});
