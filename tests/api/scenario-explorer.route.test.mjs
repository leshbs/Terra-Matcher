import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const routeSource = await readFile(new URL("../../app/api/scenarios/[scenarioId]/explorer/route.ts", import.meta.url), "utf8");
const moduleUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

async function loadRoute({ loadProductionScenario, loadExplorerSamples, assembleExplorerDataset }) {
  const nextServer = moduleUrl(`export async function connection() {}\nexport const NextResponse = { json(body, init = {}) { return new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } }); } };`);
  const repository = moduleUrl(`export const buildExplorerAssemblyContext = (context) => context; export const loadExplorerSamples = ${loadExplorerSamples};`);
  const scenarioRepository = moduleUrl(`export const loadProductionScenario = ${loadProductionScenario};`);
  const assembler = moduleUrl(`export const assembleExplorerDataset = ${assembleExplorerDataset};`);
  const source = stripTypeScriptTypes(routeSource, { mode: "transform" })
    .replace('"next/server"', JSON.stringify(nextServer))
    .replace('"@/lib/explore/production"', JSON.stringify(repository))
    .replace('"@/lib/scenario-production"', JSON.stringify(scenarioRepository))
    .replace('"@/lib/explore/assembler"', JSON.stringify(assembler));
  return import(moduleUrl(`${source}\n//# sourceURL=explorer-route-${Math.random()}.mjs`));
}

test("explorer route rejects malformed scenario IDs before production loading", async () => {
  const route = await loadRoute({ loadProductionScenario: 'async () => { throw new Error("must not load"); }', loadExplorerSamples: 'async () => []', assembleExplorerDataset: '() => ({})' });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "bad/id" }) });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: { code: "INVALID_SCENARIO_ID", message: "Scenario ID is invalid." } });
});

test("explorer route maps an absent scenario to the public 404 contract", async () => {
  const route = await loadRoute({ loadProductionScenario: 'async () => { throw new Error("Scenario was not found."); }', loadExplorerSamples: 'async () => []', assembleExplorerDataset: '() => ({})' });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "mars-1" }) });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: "SCENARIO_NOT_FOUND", message: "Scenario was not found." } });
});

test("explorer route returns the canonical production envelope", async () => {
  const route = await loadRoute({
    loadProductionScenario: 'async () => ({ modelRun: { id: "run-9" }, windows: [{ id: "mars-1" }] })',
    loadExplorerSamples: 'async (runId) => [{ id: "sample-1", runId }]',
    assembleExplorerDataset: '(context, samples) => ({ data: { windows: samples }, meta: { modelRunId: context.modelRun.id, modelVersion: "ecdf-v9", dataMode: "production" } })',
  });
  const response = await route.GET(new Request("https://example.test"), { params: Promise.resolve({ scenarioId: "mars_1" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { data: { windows: [{ id: "sample-1", runId: "run-9" }] }, meta: { modelRunId: "run-9", modelVersion: "ecdf-v9", dataMode: "production" } });
});
