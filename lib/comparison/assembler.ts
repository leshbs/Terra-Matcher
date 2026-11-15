import "server-only";

import {
  FEATURE_KEYS,
  comparisonDatasetSchema,
  type ComparisonDataset,
} from "@/components/comparison/contracts";
import type { ProductionScenarioContext } from "@/lib/scenario-production";

const weights = {
  median_slope_deg: 0.35,
  terrain_roughness_m: 0.35,
  relative_relief_m: 0.3,
} as const;

const definitions = {
  median_slope_deg: { label: "Median slope", shortLabel: "Slope", unit: "degrees", unitSymbol: "°", weight: 0.35, analysisWindow: "3 km local window", description: "Median slope derived from the DEM." },
  terrain_roughness_m: { label: "Terrain roughness", shortLabel: "Roughness", unit: "metres", unitSymbol: "m", weight: 0.35, analysisWindow: "3 km local window", description: "Local elevation variability." },
  relative_relief_m: { label: "Relative relief", shortLabel: "Relief", unit: "metres", unitSymbol: "m", weight: 0.3, analysisWindow: "3 km local window", description: "Local maximum minus minimum elevation." },
} as const;

type Profile = {
  location_id: string; location_kind: "scenario" | "candidate"; latitude: number; longitude: number; radius_km: number;
  summary: string; operational_hypothesis: string; source_dataset_ids: string[]; limitations: string[];
  analysis_resolution_m: number; local_window_km: number; quality_flag: string;
  features: Record<string, { rawValue: number; normalizedValue: number; unit: string; sourceDatasetId: string }>;
};
type Score = { candidate_id: string; rank: number; similarity_score: number; data_coverage: number };
type Evidence = { location_id: string; limitations?: string[]; largest_mismatch?: { feature_key?: string } };
type Contribution = { candidate_id: string; feature_key: string; normalized_weight: number; available: boolean; feature_distance: number; weighted_contribution: number };
type Dataset = { id: string; provider: string; product: string; version: string; url: string; citation: string; native_resolution: unknown; unit: string };

export function assembleComparisonDataset(context: ProductionScenarioContext): ComparisonDataset {
  const profiles = context.locationProfiles as Profile[];
  const scenarioProfile = profiles.find((item) => item.location_kind === "scenario");
  const candidatesById = new Map(profiles.filter((item) => item.location_kind === "candidate").map((item) => [item.location_id, item]));
  const evidenceById = new Map((context.evidence as Evidence[]).map((item) => [item.location_id, item]));
  const contributionByCandidate = new Map<string, Contribution[]>();
  for (const item of context.contributions as Contribution[]) contributionByCandidate.set(item.candidate_id, [...(contributionByCandidate.get(item.candidate_id) ?? []), item]);
  if (!scenarioProfile) throw new Error("Production context is missing the scenario profile.");
  const location = (profile: Profile, body: "mars" | "earth") => ({
    id: profile.location_id, name: body === "mars" ? context.scenario.name : profile.summary,
    body, center: { latitude: profile.latitude, longitude: profile.longitude }, radiusKm: profile.radius_km,
    summary: profile.summary, operationalHypothesis: profile.operational_hypothesis,
    sourceDatasetIds: profile.source_dataset_ids, limitations: profile.limitations,
    features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, { ...profile.features[key], analysisResolutionM: profile.analysis_resolution_m, localWindowKm: profile.local_window_km, qualityFlag: profile.quality_flag }])),
  });
  const dataset = {
    schemaVersion: "1.0.0", dataMode: "production", disclaimer: "data-derived similarity, not mission-site approval",
    model: { modelRunId: context.modelRun.id, modelVersion: context.modelRun.transformation_version, generatedAt: new Date().toISOString(), algorithm: "Weighted L1 distance over body-specific ECDF mid-rank percentiles", transformationVersion: context.modelRun.transformation_version, weights, provenanceNote: "Source-backed production terrain profiles." },
    featureDefinitions: definitions,
    datasets: (context.datasets as Dataset[]).map((item) => ({ id: item.id, provider: item.provider, product: item.product, version: item.version, url: item.url, citation: item.citation, nativeResolution: JSON.stringify(item.native_resolution), unit: item.unit, role: "terrain source" })),
    scenario: { ...location(scenarioProfile, "mars"), kind: "reference-scenario" },
    candidates: (context.candidateScores as Score[]).map((score) => {
      const profile = candidatesById.get(score.candidate_id); const evidence = evidenceById.get(score.candidate_id);
      if (!profile) throw new Error(`Production context is missing candidate profile ${score.candidate_id}.`);
      return { ...location(profile, "earth"), kind: "candidate", country: "Unspecified", rank: score.rank, similarityScore: score.similarity_score, dataCoverage: score.data_coverage, profileStatus: score.data_coverage === 1 ? "complete" : "partial", contributions: (contributionByCandidate.get(score.candidate_id) ?? []).map((item) => ({ featureKey: item.feature_key, weight: weights[item.feature_key as keyof typeof weights], normalizedWeight: item.normalized_weight, available: item.available, featureDistance: item.feature_distance, weightedContribution: item.weighted_contribution, note: "Source-backed ranking contribution." })), matchPoints: [], mismatchPoints: [evidence?.largest_mismatch?.feature_key ?? "See feature contributions."], limitations: evidence?.limitations ?? profile.limitations };
    }),
    globalLimitations: ["Terrain-feature comparison only.", "Data-derived similarity, not mission-site approval."],
  };
  return comparisonDatasetSchema.parse(dataset);
}
