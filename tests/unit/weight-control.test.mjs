// Run with: node --test tests/unit/weight-control.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL(
  "../../data/fixtures/comparison-demo.json",
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const featureKeys = [
  "median_slope_deg",
  "terrain_roughness_m",
  "relative_relief_m",
];

function normalizeWeights(weights) {
  const total = featureKeys.reduce((sum, key) => sum + weights[key], 0);
  if (total <= 0) {
    const equal = 1 / featureKeys.length;
    return Object.fromEntries(featureKeys.map((key) => [key, equal]));
  }
  return Object.fromEntries(
    featureKeys.map((key) => [key, weights[key] / total]),
  );
}

function recomputeWithWeights(contributions, requestedWeights) {
  const weights = normalizeWeights(requestedWeights);
  const byKey = Object.fromEntries(
    contributions.map((contribution) => [
      contribution.featureKey,
      contribution,
    ]),
  );

  let availableWeight = 0;
  for (const key of featureKeys) {
    if (byKey[key]?.available) availableWeight += weights[key];
  }

  let weightedDistance = 0;
  for (const key of featureKeys) {
    const base = byKey[key];
    if (!base?.available || base.featureDistance === null || availableWeight <= 0) {
      continue;
    }
    weightedDistance += (weights[key] / availableWeight) * base.featureDistance;
  }

  return {
    similarityScore: 100 * (1 - weightedDistance),
    dataCoverage: availableWeight,
  };
}

test("baseline model weights reproduce the published candidate score", () => {
  for (const candidate of fixture.candidates) {
    const result = recomputeWithWeights(
      candidate.contributions,
      fixture.model.weights,
    );
    assert.ok(
      Math.abs(result.similarityScore - candidate.similarityScore) < 0.01,
      `${candidate.id}: expected ${candidate.similarityScore}, got ${result.similarityScore}`,
    );
    assert.ok(
      Math.abs(result.dataCoverage - candidate.dataCoverage) < 1e-9,
      `${candidate.id}: coverage mismatch`,
    );
  }
});

test("emphasising a mismatched feature lowers the exploratory score", () => {
  const candidate = fixture.candidates.find(
    (item) => item.id === "earth-atacama-desert-chile-v1",
  );
  assert.ok(candidate);

  const largestGap = [...candidate.contributions]
    .filter((item) => item.available)
    .sort(
      (left, right) =>
        right.weightedContribution - left.weightedContribution,
    )[0];

  const skewed = {
    median_slope_deg: 0.1,
    terrain_roughness_m: 0.1,
    relative_relief_m: 0.1,
  };
  skewed[largestGap.featureKey] = 0.8;

  const result = recomputeWithWeights(candidate.contributions, skewed);
  assert.ok(
    result.similarityScore < candidate.similarityScore,
    "skewing weight toward the largest gap should reduce the score",
  );
});
