import "server-only";

import type { ProductionScenarioContext } from "@/lib/scenario-production";
import type { ExplorerAssemblyContext, ExplorerSampleInput } from "./contracts";

type Profile = {
  location_id: string;
  location_kind: "scenario" | "candidate";
  latitude: number;
  longitude: number;
  summary: string;
  operational_hypothesis: string;
  limitations: string[];
  source_dataset_ids: string[];
  features: Record<string, { rawValue: number; sourceDatasetId: string }>;
};

const featureValue = (profile: Profile, key: string) => {
  const value = profile.features[key]?.rawValue;
  if (!Number.isFinite(value)) throw new Error(`Explorer profile ${profile.location_id} is missing ${key}.`);
  return value;
};

export function buildExplorerAssemblyContext(context: ProductionScenarioContext): ExplorerAssemblyContext {
  const profiles = context.locationProfiles as Profile[];
  const scores = context.candidateScores as Array<{ candidate_id: string; rank: number; similarity_score: number; data_coverage: number }>;
  const contributions = context.contributions as Array<{ candidate_id: string; feature_key: string; candidate_raw_value: number; reference_raw_value: number; weighted_contribution: number }>;
  const scoreByCandidate = new Map(scores.map((score) => [score.candidate_id, score]));
  const contributionByCandidate = new Map<string, typeof contributions>();
  for (const contribution of contributions) {
    contributionByCandidate.set(contribution.candidate_id, [...(contributionByCandidate.get(contribution.candidate_id) ?? []), contribution]);
  }

  return {
    scenario: { id: context.scenario.id },
    modelRun: { id: context.modelRun.id, status: context.modelRun.status, modelVersion: context.modelRun.transformation_version },
    datasets: (context.datasets as Array<Record<string, unknown>>).map((dataset) => ({
      id: String(dataset.id), short: String(dataset.product), provider: String(dataset.provider),
      resolution: JSON.stringify(dataset.native_resolution), unit: String(dataset.unit), license: "See source citation.",
      citation: String(dataset.citation), limitations: Array.isArray(dataset.limitations) ? dataset.limitations.map(String) : [],
    })),
    windows: profiles.slice().sort((left, right) => {
      if (left.location_kind === "scenario") return -1;
      if (right.location_kind === "scenario") return 1;
      return (scoreByCandidate.get(left.location_id)?.rank ?? Number.MAX_SAFE_INTEGER)
        - (scoreByCandidate.get(right.location_id)?.rank ?? Number.MAX_SAFE_INTEGER);
    }).map((profile) => {
      const score = scoreByCandidate.get(profile.location_id);
      const matched = contributionByCandidate.get(profile.location_id) ?? [];
      const strongest = matched.slice().sort((left, right) => left.weighted_contribution - right.weighted_contribution)[0]?.feature_key;
      const mismatch = matched.slice().sort((left, right) => right.weighted_contribution - left.weighted_contribution)[0]?.feature_key;
      const datasetId = profile.features.median_slope_deg?.sourceDatasetId;
      if (!datasetId) throw new Error(`Explorer profile ${profile.location_id} has no source dataset.`);
      const shared = {
        id: profile.location_id, scenarioId: context.scenario.id, name: profile.location_kind === "scenario" ? context.scenario.name : profile.summary,
        kind: profile.location_kind, body: profile.location_kind === "scenario" ? "mars" as const : "earth" as const,
        center: [profile.longitude, profile.latitude] as [number, number], datasetId, hypothesis: profile.operational_hypothesis,
        limitations: profile.limitations, features: {
          slope: featureValue(profile, "median_slope_deg"), rough: featureValue(profile, "terrain_roughness_m"), relief: featureValue(profile, "relative_relief_m"),
        },
      };
      if (profile.location_kind === "candidate") {
        if (!score) throw new Error(`Explorer candidate ${profile.location_id} has no ranking score.`);
        if (matched.length !== 3 || !strongest || !mismatch) {
          throw new Error(`Explorer candidate ${profile.location_id} has incomplete ranking evidence.`);
        }
        return {
          ...shared, rank: score.rank, score: score.similarity_score, coverage: score.data_coverage,
          contributions: matched.map((item) => ({ featureKey: item.feature_key, candidateRaw: item.candidate_raw_value, referenceRaw: item.reference_raw_value, weightedContribution: item.weighted_contribution })),
          strongest, mismatch,
        };
      }
      return shared;
    }),
  };
}

export async function loadExplorerSamples(modelRunId: string, locationIds: string[]): Promise<ExplorerSampleInput[]> {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const result = await supabaseServer.from("explorer_grid_samples")
    .select("id, model_run_id, location_id, dataset_id, offset_east_km, offset_north_km, slope, roughness, relative_relief, quality_flag")
    .eq("model_run_id", modelRunId).in("location_id", locationIds);
  if (result.error) throw new Error("Explorer grid samples are unavailable.");
  return (result.data ?? []).map((sample) => ({
    id: sample.id, modelRunId: sample.model_run_id, windowId: sample.location_id, datasetId: sample.dataset_id,
    eastKm: sample.offset_east_km, northKm: sample.offset_north_km, slope: sample.slope,
    roughness: sample.roughness, relief: sample.relative_relief,
  }));
}
