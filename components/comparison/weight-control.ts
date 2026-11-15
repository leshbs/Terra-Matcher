import {
  FEATURE_KEYS,
  type FeatureContribution,
  type FeatureKey,
} from "./contracts";

export type FeatureWeights = Record<FeatureKey, number>;

export type RecomputedContribution = FeatureContribution & {
  exploratory: true;
};

export type WeightRecomputeResult = {
  weights: FeatureWeights;
  contributions: RecomputedContribution[];
  similarityScore: number;
  dataCoverage: number;
  profileStatus: "complete" | "partial";
};

export function cloneFeatureWeights(weights: FeatureWeights): FeatureWeights {
  return {
    median_slope_deg: weights.median_slope_deg,
    terrain_roughness_m: weights.terrain_roughness_m,
    relative_relief_m: weights.relative_relief_m,
  };
}

export function sumFeatureWeights(weights: FeatureWeights): number {
  return FEATURE_KEYS.reduce((total, key) => total + weights[key], 0);
}

/** Renormalise positive weights so they sum to 1. Zero-total falls back to equal thirds. */
export function normalizeFeatureWeights(
  weights: FeatureWeights,
): FeatureWeights {
  const total = sumFeatureWeights(weights);

  if (total <= 0) {
    const equal = 1 / FEATURE_KEYS.length;
    return {
      median_slope_deg: equal,
      terrain_roughness_m: equal,
      relative_relief_m: equal,
    };
  }

  return {
    median_slope_deg: weights.median_slope_deg / total,
    terrain_roughness_m: weights.terrain_roughness_m / total,
    relative_relief_m: weights.relative_relief_m / total,
  };
}

export function weightsAreEqual(
  left: FeatureWeights,
  right: FeatureWeights,
  epsilon = 0.000001,
): boolean {
  return FEATURE_KEYS.every(
    (key) => Math.abs(left[key] - right[key]) <= epsilon,
  );
}

/**
 * Client-side exploratory re-score using published feature distances.
 * Does not change the official model-run score stored on the candidate.
 */
export function recomputeWithWeights(
  contributions: FeatureContribution[],
  requestedWeights: FeatureWeights,
): WeightRecomputeResult {
  const weights = normalizeFeatureWeights(requestedWeights);
  const byKey = Object.fromEntries(
    contributions.map((contribution) => [
      contribution.featureKey,
      contribution,
    ]),
  ) as Record<FeatureKey, FeatureContribution>;

  let availableWeight = 0;
  for (const key of FEATURE_KEYS) {
    if (byKey[key]?.available) {
      availableWeight += weights[key];
    }
  }

  const dataCoverage = availableWeight;
  let weightedDistance = 0;

  const nextContributions: RecomputedContribution[] = FEATURE_KEYS.map(
    (key) => {
      const base = byKey[key];
      if (!base) {
        throw new Error(`Missing contribution for feature: ${key}`);
      }

      const weight = weights[key];

      if (!base.available || base.featureDistance === null || dataCoverage <= 0) {
        return {
          ...base,
          weight,
          normalizedWeight: 0,
          weightedContribution: 0,
          exploratory: true,
        };
      }

      const normalizedWeight = weight / dataCoverage;
      const weightedContribution = normalizedWeight * base.featureDistance;
      weightedDistance += weightedContribution;

      return {
        ...base,
        weight,
        normalizedWeight,
        weightedContribution,
        exploratory: true,
      };
    },
  );

  return {
    weights,
    contributions: nextContributions,
    similarityScore: 100 * (1 - weightedDistance),
    dataCoverage,
    profileStatus: dataCoverage === 1 ? "complete" : "partial",
  };
}
