import {
  PARTIAL_DISTANCE_THRESHOLD,
  type ComparisonCandidate,
  type FeatureKey,
} from "./contracts";

export type PriorityFeature = FeatureKey | "none";

export type RankingFilters = {
  minScore: number;
  maxScore: number;
  minCoverage: number;
  priorityFeature: PriorityFeature;
};

export const DEFAULT_RANKING_FILTERS: RankingFilters = {
  minScore: 0,
  maxScore: 100,
  minCoverage: 0,
  priorityFeature: "none",
};

export const COVERAGE_FILTER_OPTIONS = [
  { value: 0, label: "Any coverage" },
  { value: 0.5, label: "50% or more" },
  { value: 0.7, label: "70% or more" },
  { value: 0.9, label: "90% or more" },
  { value: 1, label: "Complete (100%)" },
] as const;

export function getPriorityContribution(
  candidate: ComparisonCandidate,
  priorityFeature: PriorityFeature,
) {
  if (priorityFeature === "none") return null;

  return (
    candidate.contributions.find(
      (contribution) => contribution.featureKey === priorityFeature,
    ) ?? null
  );
}

export function getPriorityDistance(
  candidate: ComparisonCandidate,
  priorityFeature: PriorityFeature,
): number | null {
  const contribution = getPriorityContribution(candidate, priorityFeature);

  if (!contribution?.available || contribution.featureDistance === null) {
    return null;
  }

  return contribution.featureDistance;
}

export function filterRankingCandidates(
  candidates: ComparisonCandidate[],
  filters: RankingFilters,
): ComparisonCandidate[] {
  return candidates.filter((candidate) => {
    if (
      candidate.similarityScore < filters.minScore ||
      candidate.similarityScore > filters.maxScore
    ) {
      return false;
    }

    if (candidate.dataCoverage + 0.000001 < filters.minCoverage) {
      return false;
    }

    if (filters.priorityFeature === "none") {
      return true;
    }

    const distance = getPriorityDistance(candidate, filters.priorityFeature);

    return distance !== null && distance <= PARTIAL_DISTANCE_THRESHOLD;
  });
}

export function hasActiveRankingFilters(filters: RankingFilters): boolean {
  return (
    filters.minScore !== DEFAULT_RANKING_FILTERS.minScore ||
    filters.maxScore !== DEFAULT_RANKING_FILTERS.maxScore ||
    filters.minCoverage !== DEFAULT_RANKING_FILTERS.minCoverage ||
    filters.priorityFeature !== DEFAULT_RANKING_FILTERS.priorityFeature
  );
}
