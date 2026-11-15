import { z } from "zod";

const featureKeySchema = z.enum([
  "median_slope_deg",
  "terrain_roughness_m",
  "relative_relief_m",
]);

const contributionSchema = z.object({
  featureKey: featureKeySchema,
  available: z.literal(true),
  normalizedWeight: z.number().positive(),
  weightedContribution: z.number().min(0),
});

const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  source: z.string().min(1),
});

const featureValuesSchema = z.object({
  medianSlopeDeg: z.number().min(0).max(90),
  terrainRoughnessM: z.number().min(0),
  relativeReliefM: z.number().min(0),
});

const evidenceSchema = z.object({
  operationalHypothesis: z.string().min(1, "An operational hypothesis is required."),
  limitations: z.array(z.string().min(1)).min(1, "A limitation statement is required."),
  sourceDatasetIds: z.array(z.string().min(1)).min(2, "Two source dataset IDs are required."),
});

export const evidenceBackedRankingSchema = z.object({
  modelRunId: z.string().min(1),
  modelVersion: z.string().min(1),
  scenarioId: z.string().min(1),
  candidateId: z.string().min(1),
  similarityScore: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  dataCoverage: z.literal(1),
  sourceDatasetIds: z.array(z.string().min(1)).length(2),
  generatedAt: z.iso.datetime({ offset: true }),
  features: featureValuesSchema,
  candidate: candidateSchema,
  contributions: z.array(contributionSchema).length(3),
  evidence: evidenceSchema,
}).superRefine((value, context) => {
  if (value.candidate.id !== value.candidateId) {
    context.addIssue({ code: "custom", message: "Candidate ID does not match the candidate record." });
  }
  if (new Set(value.contributions.map((item) => item.featureKey)).size !== 3) {
    context.addIssue({ code: "custom", message: "The three required feature contributions must be unique." });
  }
});

export type EvidenceBackedRanking = z.infer<typeof evidenceBackedRankingSchema>;

export function parseEvidenceBackedRanking(input: unknown): EvidenceBackedRanking {
  return evidenceBackedRankingSchema.parse(input);
}

type ProductionScoreRow = {
  model_run_id: string;
  model_version: string;
  scenario_id: string;
  candidate_id: string;
  similarity_score: number;
  rank: number;
  data_coverage: number;
  source_dataset_ids: string[];
  generated_at: string;
  median_slope_deg: number;
  terrain_roughness_m: number;
  relative_relief_m: number;
  candidates: unknown;
};

type ProductionContributionRow = {
  model_run_id: string;
  scenario_id: string;
  candidate_id: string;
  feature_key: string;
  available: boolean;
  normalized_weight: number;
  weighted_contribution: number;
};

type ProductionEvidenceRow = {
  model_run_id: string;
  location_id: string;
  operational_hypothesis: string;
  limitations: string[];
  source_dataset_ids: string[];
};

export function buildProductionCandidates(
  scores: ProductionScoreRow[],
  contributions: ProductionContributionRow[],
  evidence: ProductionEvidenceRow[],
): EvidenceBackedRanking[] {
  const contributionsByCandidate = new Map<string, ProductionContributionRow[]>();
  for (const contribution of contributions) {
    const rows = contributionsByCandidate.get(contribution.candidate_id) ?? [];
    rows.push(contribution);
    contributionsByCandidate.set(contribution.candidate_id, rows);
  }
  const evidenceByCandidate = new Map(evidence.map((item) => [item.location_id, item]));

  return scores.map((score) => parseEvidenceBackedRanking({
    modelRunId: score.model_run_id,
    modelVersion: score.model_version,
    scenarioId: score.scenario_id,
    candidateId: score.candidate_id,
    similarityScore: score.similarity_score,
    rank: score.rank,
    dataCoverage: score.data_coverage,
    sourceDatasetIds: score.source_dataset_ids,
    generatedAt: score.generated_at,
    features: {
      medianSlopeDeg: score.median_slope_deg,
      terrainRoughnessM: score.terrain_roughness_m,
      relativeReliefM: score.relative_relief_m,
    },
    candidate: score.candidates,
    contributions: (contributionsByCandidate.get(score.candidate_id) ?? []).map((item) => ({
      featureKey: item.feature_key,
      available: item.available,
      normalizedWeight: item.normalized_weight,
      weightedContribution: item.weighted_contribution,
    })),
    evidence: evidenceByCandidate.get(score.candidate_id) && {
      operationalHypothesis: evidenceByCandidate.get(score.candidate_id)?.operational_hypothesis,
      limitations: evidenceByCandidate.get(score.candidate_id)?.limitations,
      sourceDatasetIds: evidenceByCandidate.get(score.candidate_id)?.source_dataset_ids,
    },
  }));
}
