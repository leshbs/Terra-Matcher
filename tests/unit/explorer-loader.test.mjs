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
  assert.match(loaderSource, /raw === "fixture"/);
  assert.match(loaderSource, /Unsupported EXPLORER_DATA_SOURCE/);
  assert.doesNotMatch(loaderSource, /catch[\s\S]{0,300}loadFixture/);
});

test("Explorer loader reports request and response failures with useful context", () => {
  assert.match(loaderSource, /Explorer \$\{label\} could not be reached/);
  assert.match(loaderSource, /Explorer \$\{label\} returned HTTP/);
  assert.match(loaderSource, /Explorer \$\{label\} response was not valid JSON/);
  assert.match(loaderSource, /Explorer API response does not match the UI data contract/);
});

test("Explorer loader requires canonical cells from the API and only derives legacy fixture cells", () => {
  assert.match(loaderSource, /hasCanonicalGrid\(explorerData\)/);
  assert.match(loaderSource, /if \(mode === "fixture"\)/);
  assert.match(loaderSource, /cells: buildCells\(windows\)/);
});
