import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
const summary = await readFile(new URL("../../components/mission-control/RankingSummary.tsx", import.meta.url), "utf8");

test("home loads the canonical comparison bundle and exposes the three main routes", () => {
  assert.match(home, /getComparisonBundle/);
  assert.match(home, /RankingSummary/);
  assert.match(summary, /href="\/compare"/);
  assert.match(summary, /href="\/explore"/);
  assert.doesNotMatch(home, /ComparisonDashboard/);
});
