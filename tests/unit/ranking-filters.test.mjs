// Run with: node --test tests/unit/ranking-filters.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL(
  "../../data/fixtures/comparison-demo.json",
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const PARTIAL_DISTANCE_THRESHOLD = 0.25;

function filterCandidates(candidates, filters) {
  return candidates.filter((candidate) => {
    if (
      candidate.similarityScore < filters.minScore ||
      candidate.similarityScore > filters.maxScore
    ) {
      return false;
    }

    if (candidate.dataCoverage + 1e-9 < filters.minCoverage) {
      return false;
    }

    if (filters.priorityFeature === "none") {
      return true;
    }

    const contribution = candidate.contributions.find(
      (item) => item.featureKey === filters.priorityFeature,
    );

    return (
      contribution?.available === true &&
      contribution.featureDistance !== null &&
      contribution.featureDistance <= PARTIAL_DISTANCE_THRESHOLD
    );
  });
}

test("score-range filter keeps only candidates inside the band", () => {
  const filtered = filterCandidates(fixture.candidates, {
    minScore: 70,
    maxScore: 100,
    minCoverage: 0,
    priorityFeature: "none",
  });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.length < fixture.candidates.length);
  assert.ok(filtered.every((candidate) => candidate.similarityScore >= 70));
});

test("coverage filter excludes the partial-profile candidate", () => {
  const filtered = filterCandidates(fixture.candidates, {
    minScore: 0,
    maxScore: 100,
    minCoverage: 1,
    priorityFeature: "none",
  });

  assert.equal(
    filtered.some((candidate) => candidate.profileStatus === "partial"),
    false,
  );
  assert.ok(
    filtered.every((candidate) => candidate.dataCoverage === 1),
  );
});

test("priority-feature filter keeps only close matches on that feature", () => {
  const filtered = filterCandidates(fixture.candidates, {
    minScore: 0,
    maxScore: 100,
    minCoverage: 0,
    priorityFeature: "median_slope_deg",
  });

  assert.ok(filtered.length > 0);

  for (const candidate of filtered) {
    const contribution = candidate.contributions.find(
      (item) => item.featureKey === "median_slope_deg",
    );
    assert.equal(contribution.available, true);
    assert.ok(contribution.featureDistance <= PARTIAL_DISTANCE_THRESHOLD);
  }
});

test("combined filters can yield an empty visible set", () => {
  const filtered = filterCandidates(fixture.candidates, {
    minScore: 99,
    maxScore: 100,
    minCoverage: 1,
    priorityFeature: "relative_relief_m",
  });

  assert.equal(filtered.length, 0);
});
