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
