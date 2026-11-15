import "server-only";

import fixtureJson from "@/data/fixtures/comparison-demo.json";
import {
  comparisonFixtureSchema,
  type ComparisonCandidate,
  type ComparisonFixture,
  type ComparisonScenario,
  type DatasetRecord,
} from "./contracts";

function parseFixture(): ComparisonFixture {
  const parsed = comparisonFixtureSchema.safeParse(fixtureJson);

  if (!parsed.success) {
    console.error(
      "[comparison-fixture] Invalid fixture data.",
      parsed.error.format(),
    );
    throw new Error(
      "Comparison fixture does not match the comparison data contract.",
    );
  }

  return parsed.data;
}

export const comparisonFixture = parseFixture();

export function getRankedCandidates(
  scenarioId: string,
): ComparisonCandidate[] | null {
  if (comparisonFixture.scenario.id !== scenarioId) return null;

  return [...comparisonFixture.candidates].sort(
    (left, right) => left.rank - right.rank,
  );
}

export function getComparisonCandidate(
  scenarioId: string,
  candidateId: string,
): ComparisonCandidate | null {
  if (comparisonFixture.scenario.id !== scenarioId) return null;

  return (
    comparisonFixture.candidates.find(
      (candidate) => candidate.id === candidateId,
    ) ?? null
  );
}

export function getComparisonScenario(
  scenarioId: string,
): ComparisonScenario | null {
  return comparisonFixture.scenario.id === scenarioId
    ? comparisonFixture.scenario
    : null;
}

export function getDatasetsById(): Record<string, DatasetRecord> {
  return Object.fromEntries(
    comparisonFixture.datasets.map((dataset) => [dataset.id, dataset]),
  );
}

export function getComparisonView(
  scenarioId: string,
  candidateId: string,
):
  | {
      scenario: ComparisonScenario;
      candidate: ComparisonCandidate;
      candidates: ComparisonCandidate[];
    }
  | null {
  const candidates = getRankedCandidates(scenarioId);

  if (candidates === null) return null;

  const candidate = candidates.find((item) => item.id === candidateId);

  if (!candidate) return null;

  return {
    scenario: comparisonFixture.scenario,
    candidate,
    candidates,
  };
}
