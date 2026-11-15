import { z } from "zod";

export const FEATURE_KEYS = [
  "median_slope_deg",
  "terrain_roughness_m",
  "relative_relief_m",
] as const;

export const featureKeySchema = z.enum(FEATURE_KEYS);

export type FeatureKey = z.infer<typeof featureKeySchema>;

export type FeatureStatus = "match" | "partial" | "mismatch" | "no-data";

export type ScoreBand = "very-close" | "close" | "mixed" | "distant";

export const MATCH_DISTANCE_THRESHOLD = 0.1;
export const PARTIAL_DISTANCE_THRESHOLD = 0.25;

const dataModeSchema = z.enum(["fixture", "production"]);

const featureDefinitionSchema = z.object({
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  unit: z.string().min(1),
  unitSymbol: z.string().min(1),
  weight: z.number().min(0).max(1),
  analysisWindow: z.string().min(1),
  description: z.string().min(1),
});

const featureValueSchema = z.object({
  rawValue: z.number().nullable(),
  unit: z.string().min(1),
  normalizedValue: z.number().min(0).max(1).nullable(),
  sourceDatasetId: z.string().min(1),
  analysisResolutionM: z.number().positive(),
  localWindowKm: z.number().positive(),
  qualityFlag: z.enum([
    "source-backed-derived",
    "fixture-illustrative",
    "no-data",
    "invalid",
  ]),
});

const datasetSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  product: z.string().min(1),
  version: z.string().min(1),
  url: z.string().url(),
  citation: z.string().min(1),
  nativeResolution: z.string().min(1),
  unit: z.string().min(1),
  role: z.string().min(1),
});

const weightsSchema = z.object({
  median_slope_deg: z.number().min(0).max(1),
  terrain_roughness_m: z.number().min(0).max(1),
  relative_relief_m: z.number().min(0).max(1),
});

const modelSchema = z.object({
  modelRunId: z.string().min(1),
  modelVersion: z.string().min(1),
  generatedAt: z.iso.datetime({ offset: true }),
  algorithm: z.string().min(1),
  transformationVersion: z.string().min(1),
  weights: weightsSchema,
  provenanceNote: z.string().min(1),
});

const locationBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.enum(["mars", "earth", "moon"]),
  center: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  radiusKm: z.number().positive(),
  summary: z.string().min(1),
  operationalHypothesis: z.string().min(1),
  sourceDatasetIds: z.array(z.string().min(1)).min(1),
  features: z.object({
    median_slope_deg: featureValueSchema,
    terrain_roughness_m: featureValueSchema,
    relative_relief_m: featureValueSchema,
  }),
  limitations: z.array(z.string().min(1)).min(1),
});

const scenarioSchema = locationBaseSchema.extend({
  body: z.literal("mars"),
  kind: z.literal("reference-scenario"),
});

const contributionSchema = z
  .object({
    featureKey: featureKeySchema,
    weight: z.number().min(0).max(1),
    normalizedWeight: z.number().min(0).max(1),
    available: z.boolean(),
    featureDistance: z.number().min(0).max(1).nullable(),
    weightedContribution: z.number().min(0).max(1),
    note: z.string().min(1),
  })
  .superRefine((contribution, context) => {
    if (!contribution.available) {
      if (
        contribution.featureDistance !== null ||
        contribution.normalizedWeight !== 0 ||
        contribution.weightedContribution !== 0
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Unavailable feature must have no distance, weight, or contribution.",
        });
      }
      return;
    }

    if (
      contribution.featureDistance === null ||
      contribution.normalizedWeight <= 0
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Available feature must have a distance and a positive normalized weight.",
      });
    }
  });

const candidateSchema = locationBaseSchema.extend({
  body: z.literal("earth"),
  kind: z.literal("candidate"),
  country: z.string().min(1),
  rank: z.number().int().min(1),
  similarityScore: z.number().min(0).max(100),
  dataCoverage: z.number().gt(0).max(1),
  profileStatus: z.enum(["complete", "partial"]),
  contributions: z.array(contributionSchema).length(FEATURE_KEYS.length),
  matchPoints: z.array(z.string().min(1)),
  mismatchPoints: z.array(z.string().min(1)).min(1),
});

const comparisonDatasetBaseSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    dataMode: dataModeSchema,
    disclaimer: z.literal(
      "data-derived similarity, not mission-site approval",
    ),
    model: modelSchema,
    featureDefinitions: z.object({
      median_slope_deg: featureDefinitionSchema,
      terrain_roughness_m: featureDefinitionSchema,
      relative_relief_m: featureDefinitionSchema,
    }),
    datasets: z.array(datasetSchema).min(1),
    scenario: scenarioSchema,
    candidates: z.array(candidateSchema).min(1).max(10),
    globalLimitations: z.array(z.string().min(1)).min(1),
  })
  .superRefine((fixture, context) => {
    const weightTotal = FEATURE_KEYS.reduce(
      (total, key) => total + fixture.model.weights[key],
      0,
    );

    if (Math.abs(weightTotal - 1) > 0.000001) {
      context.addIssue({
        code: "custom",
        message: "Model weights must sum to 1.",
        path: ["model", "weights"],
      });
    }

    for (const key of FEATURE_KEYS) {
      if (
        fixture.featureDefinitions[key].weight !== fixture.model.weights[key]
      ) {
        context.addIssue({
          code: "custom",
          message: `Feature definition weight does not match model weight for ${key}.`,
          path: ["featureDefinitions", key, "weight"],
        });
      }
    }

    const datasetIds = new Set(fixture.datasets.map((dataset) => dataset.id));
    const referencedDatasetIds = [
      ...fixture.scenario.sourceDatasetIds,
      ...fixture.candidates.flatMap((candidate) => candidate.sourceDatasetIds),
      ...Object.values(fixture.scenario.features).map(
        (feature) => feature.sourceDatasetId,
      ),
      ...fixture.candidates.flatMap((candidate) =>
        Object.values(candidate.features).map(
          (feature) => feature.sourceDatasetId,
        ),
      ),
    ];

    for (const datasetId of referencedDatasetIds) {
      if (!datasetIds.has(datasetId)) {
        context.addIssue({
          code: "custom",
          message: `Dataset reference is missing from datasets: ${datasetId}.`,
        });
      }
    }

    const locationIds = new Set([
      fixture.scenario.id,
      ...fixture.candidates.map((candidate) => candidate.id),
    ]);

    if (locationIds.size !== fixture.candidates.length + 1) {
      context.addIssue({
        code: "custom",
        message: "Location IDs must be unique.",
        path: ["candidates"],
      });
    }

    const sortedRanks = [...fixture.candidates]
      .sort((left, right) => left.rank - right.rank)
      .map((candidate) => candidate.rank);

    if (sortedRanks.some((rank, index) => rank !== index + 1)) {
      context.addIssue({
        code: "custom",
        message: "Candidate ranks must be unique and start at 1.",
        path: ["candidates"],
      });
    }

    for (const candidate of fixture.candidates) {
      const contributionKeys = candidate.contributions.map(
        (contribution) => contribution.featureKey,
      );

      if (new Set(contributionKeys).size !== FEATURE_KEYS.length) {
        context.addIssue({
          code: "custom",
          message: "Each candidate needs exactly one contribution per feature.",
          path: ["candidates", candidate.id, "contributions"],
        });
      }

      let availableWeight = 0;
      let weightedDistance = 0;

      for (const contribution of candidate.contributions) {
        if (contribution.weight !== fixture.model.weights[contribution.featureKey]) {
          context.addIssue({
            code: "custom",
            message: `Contribution weight does not match model weight for ${contribution.featureKey}.`,
            path: ["candidates", candidate.id, "contributions"],
          });
        }

        if (contribution.available) {
          availableWeight += contribution.weight;
          weightedDistance += contribution.weightedContribution;

          const expectedNormalizedWeight =
            contribution.weight / candidate.dataCoverage;

          if (
            Math.abs(
              contribution.normalizedWeight - expectedNormalizedWeight,
            ) > 0.000001
          ) {
            context.addIssue({
              code: "custom",
              message: `Normalized weight is inconsistent for ${candidate.id}:${contribution.featureKey}.`,
              path: ["candidates", candidate.id, "contributions"],
            });
          }

          if (contribution.featureDistance !== null) {
            const expectedContribution =
              contribution.normalizedWeight * contribution.featureDistance;

            if (
              Math.abs(
                contribution.weightedContribution - expectedContribution,
              ) > 0.000001
            ) {
              context.addIssue({
                code: "custom",
                message: `Weighted contribution is inconsistent for ${candidate.id}:${contribution.featureKey}.`,
                path: ["candidates", candidate.id, "contributions"],
              });
            }
          }
        }
      }

      if (Math.abs(availableWeight - candidate.dataCoverage) > 0.000001) {
        context.addIssue({
          code: "custom",
          message: `Data coverage does not match available weights for ${candidate.id}.`,
          path: ["candidates", candidate.id, "dataCoverage"],
        });
      }

      const expectedScore = 100 * (1 - weightedDistance);

      if (Math.abs(expectedScore - candidate.similarityScore) > 0.01) {
        context.addIssue({
          code: "custom",
          message: `Similarity score is inconsistent with contributions for ${candidate.id}.`,
          path: ["candidates", candidate.id, "similarityScore"],
        });
      }

      const expectedStatus =
        candidate.dataCoverage === 1 ? "complete" : "partial";

      if (candidate.profileStatus !== expectedStatus) {
        context.addIssue({
          code: "custom",
          message: `Profile status does not match coverage for ${candidate.id}.`,
          path: ["candidates", candidate.id, "profileStatus"],
        });
      }
    }
  });

// The backend adapter validates this same payload shape. Production runs may
// contain 1–10 candidates; the bundled demo fixture is kept stricter below.
export const comparisonDatasetSchema = comparisonDatasetBaseSchema;

export const comparisonFixtureSchema = comparisonDatasetBaseSchema.refine(
  (dataset) => dataset.dataMode === "fixture" && dataset.candidates.length === 5,
  {
    message:
      "The bundled demo fixture must use fixture mode and exactly five candidates.",
    path: ["candidates"],
  },
);

export type ComparisonDataset = z.infer<typeof comparisonDatasetBaseSchema>;
// Backwards-compatible alias for components written during Day 1.
export type ComparisonFixture = ComparisonDataset;
export type ComparisonScenario = ComparisonDataset["scenario"];
export type ComparisonCandidate = ComparisonDataset["candidates"][number];
export type FeatureContribution = ComparisonCandidate["contributions"][number];
export type FeatureDefinition =
  ComparisonDataset["featureDefinitions"][FeatureKey];
export type DatasetRecord = ComparisonDataset["datasets"][number];

export type ComparisonDataSourceInfo = {
  mode: "fixture" | "api";
  label: string;
  description: string;
  isFixture: boolean;
};

export type ComparisonSourceFailure = {
  code: "CONFIG" | "UNAVAILABLE" | "CONTRACT" | "INVALID_DATA";
  message: string;
  detail?: string;
};

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  match: "Match",
  partial: "Partial match",
  mismatch: "Mismatch",
  "no-data": "No data",
};

export const FEATURE_STATUS_STYLES: Record<
  FeatureStatus,
  { badge: string; dot: string; bar: string; text: string }
> = {
  match: {
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    dot: "bg-emerald-300",
    bar: "bg-emerald-300",
    text: "text-emerald-200",
  },
  partial: {
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    dot: "bg-amber-300",
    bar: "bg-amber-300",
    text: "text-amber-200",
  },
  mismatch: {
    badge: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
    text: "text-rose-200",
  },
  "no-data": {
    badge: "border-slate-500/40 bg-slate-500/10 text-slate-300",
    dot: "bg-slate-400",
    bar: "bg-slate-500",
    text: "text-slate-300",
  },
};

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  "very-close": "Very close terrain profile",
  close: "Close terrain profile",
  mixed: "Mixed terrain profile",
  distant: "Distant terrain profile",
};

export const SCORE_BAND_STYLES: Record<
  ScoreBand,
  { text: string; badge: string; ring: string; bar: string }
> = {
  "very-close": {
    text: "text-emerald-200",
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    ring: "#6ee7b7",
    bar: "bg-emerald-300",
  },
  close: {
    text: "text-cyan-200",
    badge: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
    ring: "#67e8f9",
    bar: "bg-cyan-300",
  },
  mixed: {
    text: "text-amber-200",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    ring: "#fcd34d",
    bar: "bg-amber-300",
  },
  distant: {
    text: "text-rose-200",
    badge: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    ring: "#fda4af",
    bar: "bg-rose-400",
  },
};

export function getScoreBand(score: number): ScoreBand {
  if (score >= 85) return "very-close";
  if (score >= 70) return "close";
  if (score >= 55) return "mixed";
  return "distant";
}

export function getFeatureStatus(
  contribution: FeatureContribution,
): FeatureStatus {
  if (
    !contribution.available ||
    contribution.featureDistance === null
  ) {
    return "no-data";
  }

  if (contribution.featureDistance <= MATCH_DISTANCE_THRESHOLD) return "match";
  if (contribution.featureDistance <= PARTIAL_DISTANCE_THRESHOLD) {
    return "partial";
  }
  return "mismatch";
}

export function getScoreImpact(contribution: FeatureContribution): number {
  return contribution.weightedContribution * 100;
}

export function getStrongestMatch(
  candidate: ComparisonCandidate,
): FeatureContribution | null {
  const available = candidate.contributions.filter(
    (contribution) => contribution.available,
  );

  if (available.length === 0) return null;

  return available.reduce((best, contribution) =>
    contribution.weightedContribution < best.weightedContribution
      ? contribution
      : best,
  );
}

export function getLargestMismatch(
  candidate: ComparisonCandidate,
): FeatureContribution | null {
  const available = candidate.contributions.filter(
    (contribution) => contribution.available,
  );

  if (available.length === 0) return null;

  return available.reduce((worst, contribution) =>
    contribution.weightedContribution > worst.weightedContribution
      ? contribution
      : worst,
  );
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatCoverage(coverage: number): string {
  return `${Math.round(coverage * 100)}%`;
}

export function formatRawValue(
  value: number | null,
  unitSymbol: string,
): string {
  if (value === null) return "No data";

  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

  return unitSymbol === "°" ? `${formatted}°` : `${formatted} ${unitSymbol}`;
}

export function formatNormalizedValue(value: number | null): string {
  return value === null ? "No data" : value.toFixed(2);
}

export function formatCoordinate(value: number, axis: "lat" | "lon"): string {
  const direction =
    axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}
