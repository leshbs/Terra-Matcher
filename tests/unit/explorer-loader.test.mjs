import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loaderUrl = new URL("../../lib/explore/data.ts", import.meta.url);
const loaderSource = await readFile(loaderUrl, "utf8");

test("Explorer loader exposes an explicit api mode for the scenario endpoint", () => {
  assert.match(loaderSource, /EXPLORER_DATA_SOURCE/);
  assert.match(loaderSource, /resolveExploreSourceMode/);
  assert.match(
    loaderSource,
    /\/api\/scenarios\/\$\{encodeURIComponent\(scenarioId\)\}\/explorer/,
  );
  assert.match(loaderSource, /cache:\s*["']no-store["']/);
});

test("Explorer loader does not silently fall back to the demo fixture", () => {
  assert.match(loaderSource, /resolveDataSourceMode/);
  assert.doesNotMatch(loaderSource, /catch[\s\S]{0,300}loadFixture/);
});

test("Explorer source mode delegates to the fail-closed shared resolver", () => {
  assert.match(loaderSource, /@\/lib\/source-mode/);
  assert.match(loaderSource, /resolveDataSourceMode\(/);
  assert.doesNotMatch(loaderSource, /raw === "api" \|\| raw === "fixture"/);
});

test("Explorer loader reports request and response failures with useful context", () => {
  assert.match(loaderSource, /Explorer \$\{label\} could not be reached/);
  assert.match(loaderSource, /Explorer \$\{label\} returned HTTP/);
  assert.match(loaderSource, /Explorer \$\{label\} response was not valid JSON/);
  assert.match(loaderSource, /Explorer API response does not match the UI data contract/);
});

test("Explorer loader requires canonical cells from the API and loads explicit fixture layers", () => {
  assert.match(loaderSource, /hasCanonicalGrid\(explorerData\)/);
  assert.match(loaderSource, /if \(mode === "fixture"\)/);
  assert.match(loaderSource, /FIXTURE_CELLS_URL/);
  assert.match(loaderSource, /loadFixturePayload/);
});
