// Run with: node --test tests/unit/comparison-fixture.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL(
  "../../data/fixtures/comparison-demo.json",
  import.meta.url,
);
const noticesUrl = new URL(
  "../../components/comparison/notices.tsx",
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const featureKeys = [
  "median_slope_deg",
  "terrain_roughness_m",
  "relative_relief_m",
];

const closeTo = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, received ${actual}`,
  );
};

test("fixture contains one Mars scenario and five Earth candidates", () => {
  assert.equal(fixture.scenario.body, "mars");
  assert.equal(fixture.scenario.kind, "reference-scenario");
  assert.equal(fixture.candidates.length, 5);
  assert.ok(fixture.candidates.every((candidate) => candidate.body === "earth"));

  const ids = [fixture.scenario.id, ...fixture.candidates.map(({ id }) => id)];
  assert.equal(new Set(ids).size, ids.length, "location IDs must be unique");
});

test("ranks are contiguous and ordered by descending score", () => {
  const ranked = [...fixture.candidates].sort(
    (left, right) => left.rank - right.rank,
  );

  assert.deepEqual(
    ranked.map(({ rank }) => rank),
    [1, 2, 3, 4, 5],
  );

  for (let index = 1; index < ranked.length; index += 1) {
    assert.ok(
      ranked[index - 1].similarityScore >= ranked[index].similarityScore,
      "scores must not increase as rank decreases",
    );
  }
});

test("scores, coverage, and contributions are internally consistent", () => {
  const modelWeightTotal = featureKeys.reduce(
    (total, key) => total + fixture.model.weights[key],
    0,
  );
  closeTo(modelWeightTotal, 1, "model weights must sum to 1");

  for (const candidate of fixture.candidates) {
    assert.ok(candidate.similarityScore >= 0);
    assert.ok(candidate.similarityScore <= 100);
    assert.ok(candidate.dataCoverage > 0);
    assert.ok(candidate.dataCoverage <= 1);
    assert.equal(candidate.contributions.length, featureKeys.length);
    assert.equal(
      candidate.profileStatus,
      candidate.dataCoverage === 1 ? "complete" : "partial",
    );

    const contributionKeys = candidate.contributions.map(
      ({ featureKey }) => featureKey,
    );
    assert.deepEqual(
      [...contributionKeys].sort(),
      [...featureKeys].sort(),
      `${candidate.id} needs one contribution per feature`,
    );

    const removedPoints = candidate.contributions.reduce(
      (total, contribution) =>
        total + contribution.weightedContribution * 100,
      0,
    );
    closeTo(
      removedPoints,
      100 - candidate.similarityScore,
      `${candidate.id} contributions must sum to the points removed`,
    );

    for (const contribution of candidate.contributions) {
      assert.equal(
        contribution.weight,
        fixture.model.weights[contribution.featureKey],
        `${candidate.id}:${contribution.featureKey} weight must match the model`,
      );

      if (contribution.available) {
        assert.ok(contribution.featureDistance !== null);
        closeTo(
          contribution.weightedContribution,
          contribution.normalizedWeight * contribution.featureDistance,
          `${candidate.id}:${contribution.featureKey} weighted contribution`,
        );
        closeTo(
          contribution.normalizedWeight,
          contribution.weight / candidate.dataCoverage,
          `${candidate.id}:${contribution.featureKey} normalized weight`,
        );
      } else {
        assert.equal(contribution.featureDistance, null);
        assert.equal(contribution.normalizedWeight, 0);
        assert.equal(contribution.weightedContribution, 0);
      }
    }
  }
});

test("partial-profile candidate marks its missing feature", () => {
  const partial = fixture.candidates.find(
    (candidate) => candidate.profileStatus === "partial",
  );

  assert.ok(partial, "fixture needs a partial-profile case");
  assert.equal(partial.dataCoverage, 0.7);

  const missing = partial.contributions.find(
    (contribution) => !contribution.available,
  );

  assert.ok(missing, "partial profile needs an unavailable contribution");
  assert.equal(missing.featureDistance, null);
  assert.equal(partial.features[missing.featureKey].rawValue, null);
  assert.equal(partial.features[missing.featureKey].normalizedValue, null);
});

test("fixture and UI use the exact required disclaimer", () => {
  const exact = "data-derived similarity, not mission-site approval";

  assert.equal(fixture.disclaimer, exact);

  return readFile(noticesUrl, "utf8").then((source) => {
    assert.ok(
      source.includes(`"${exact}"`),
      "MandatoryDisclaimer must render the exact required string",
    );
  });
});
