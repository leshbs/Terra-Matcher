import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL(
  "../../app/compare/[scenarioId]/[candidateId]/page.tsx",
  import.meta.url,
);
const routeSource = await readFile(routeUrl, "utf8");
const homeUrl = new URL("../../app/page.tsx", import.meta.url);
const compareUrl = new URL("../../app/compare/page.tsx", import.meta.url);
const [homeSource, compareSource] = await Promise.all([
  readFile(homeUrl, "utf8"),
  readFile(compareUrl, "utf8"),
]);

test("comparison detail pages do not derive public paths from fixtures", () => {
  assert.doesNotMatch(routeSource, /generateStaticParams/);
  assert.doesNotMatch(routeSource, /comparisonFixture/);
  assert.match(routeSource, /getComparisonBundle\(\{ scenarioId \}\)/);
});

test("API-backed comparison pages allow blocking runtime rendering", () => {
  for (const source of [homeSource, compareSource, routeSource]) {
    assert.match(source, /export const instant = false/);
  }
});
