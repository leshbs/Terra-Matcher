import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL(
  "../../app/compare/[scenarioId]/[candidateId]/page.tsx",
  import.meta.url,
);
const routeSource = await readFile(routeUrl, "utf8");

test("comparison detail pages do not derive public paths from fixtures", () => {
  assert.doesNotMatch(routeSource, /generateStaticParams/);
  assert.doesNotMatch(routeSource, /comparisonFixture/);
  assert.match(routeSource, /getComparisonBundle\(\{ scenarioId \}\)/);
});
