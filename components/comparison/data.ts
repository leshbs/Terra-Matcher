import "server-only";

import {
  getLocalComparisonFixture,
  loadComparisonBundle,
  type ComparisonBundle,
} from "./adapter";
import type {
  ComparisonCandidate,
  ComparisonDataset,
  ComparisonScenario,
  DatasetRecord,
} from "./contracts";

/**
 * Always the bundled Day 1 fixture. Prefer `loadComparisonBundle()` in pages
 * so the UI can switch to API mode without view-model changes.
 */
export const comparisonFixture = getLocalComparisonFixture();

export async function getComparisonBundle(options?: {
  scenarioId?: string;
}): Promise<ComparisonBundle> {
  return loadComparisonBundle(options);
}

export function getRankedCandidatesFromDataset(
  dataset: ComparisonDataset,
  scenarioId: string,
): ComparisonCandidate[] | null {
  if (dataset.scenario.id !== scenarioId) return null;

  return [...dataset.candidates].sort(
    (left, right) => left.rank - right.rank,
  );
}

export function getComparisonCandidateFromDataset(
  dataset: ComparisonDataset,
  scenarioId: string,
  candidateId: string,
): ComparisonCandidate | null {
  if (dataset.scenario.id !== scenarioId) return null;

  return (
    dataset.candidates.find((candidate) => candidate.id === candidateId) ??
    null
  );
}

export function getComparisonScenarioFromDataset(
  dataset: ComparisonDataset,
  scenarioId: string,
): ComparisonScenario | null {
  return dataset.scenario.id === scenarioId ? dataset.scenario : null;
}

export function getDatasetsByIdFromDataset(
  dataset: ComparisonDataset,
): Record<string, DatasetRecord> {
  return Object.fromEntries(
    dataset.datasets.map((datasetRecord) => [datasetRecord.id, datasetRecord]),
  );
}

export function getComparisonViewFromDataset(
  dataset: ComparisonDataset,
  scenarioId: string,
  candidateId: string,
):
  | {
      scenario: ComparisonScenario;
      candidate: ComparisonCandidate;
      candidates: ComparisonCandidate[];
    }
  | null {
  const candidates = getRankedCandidatesFromDataset(dataset, scenarioId);

  if (candidates === null) return null;

  const candidate = candidates.find((item) => item.id === candidateId);

  if (!candidate) return null;

  return {
    scenario: dataset.scenario,
    candidate,
    candidates,
  };
}

/** Fixture-backed helpers kept for Day 1 call sites and static params. */
export function getRankedCandidates(
  scenarioId: string,
): ComparisonCandidate[] | null {
  return getRankedCandidatesFromDataset(comparisonFixture, scenarioId);
}

export function getComparisonCandidate(
  scenarioId: string,
  candidateId: string,
): ComparisonCandidate | null {
  return getComparisonCandidateFromDataset(
    comparisonFixture,
    scenarioId,
    candidateId,
  );
}

export function getComparisonScenario(
  scenarioId: string,
): ComparisonScenario | null {
  return getComparisonScenarioFromDataset(comparisonFixture, scenarioId);
}

export function getDatasetsById(): Record<string, DatasetRecord> {
  return getDatasetsByIdFromDataset(comparisonFixture);
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
  return getComparisonViewFromDataset(
    comparisonFixture,
    scenarioId,
    candidateId,
  );
}
