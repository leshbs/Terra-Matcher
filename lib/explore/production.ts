import type { DatasetInfo } from "./types";
import type { ExplorerWindowInput } from "./assembler";

type WindowRow = {
  id: string;
  scenario_id: string;
  candidate_id: string | null;
  model_run_id: string;
  body: "mars" | "earth";
  name: string;
  kind: string;
  center_longitude: number;
  center_latitude: number;
  dataset_id: string;
  operational_hypothesis: string;
  limitations: string[];
  median_slope_deg: number;
  terrain_roughness_m: number;
  relative_relief_m: number;
};

type ScoreRow = {
  candidate_id: string;
  model_version: string;
  rank: number;
  similarity_score: number;
  data_coverage: number;
};

type ContributionRow = {
  candidate_id: string;
  feature_key: string;
  weighted_contribution: number;
  candidate_raw_value: number;
  reference_raw_value: number;
};

type DatasetRow = {
  id: string;
  provider: string;
  product: string;
  version: string;
  native_resolution: unknown;
  unit: string;
  citation: string;
  limitations: string[];
};

const featureKeyToLayer = {
  median_slope_deg: "slope",
  terrain_roughness_m: "rough",
  relative_relief_m: "relief",
} as const;

export function buildExplorerContext(input: {
  scenario: { id: string };
  modelRun: { id: string };
  windows: WindowRow[];
  scores: ScoreRow[];
  contributions: ContributionRow[];
  datasets: DatasetRow[];
}) {
  const scoresByCandidate = new Map(input.scores.map((score) => [score.candidate_id, score]));
  const contributionsByCandidate = new Map<string, ContributionRow[]>();
  for (const contribution of input.contributions) {
    const rows = contributionsByCandidate.get(contribution.candidate_id) ?? [];
    rows.push(contribution);
    contributionsByCandidate.set(contribution.candidate_id, rows);
  }
  const modelVersion = input.scores[0]?.model_version;
  if (!modelVersion) throw new Error("Explorer production data has no candidate score model version.");

  const windows: ExplorerWindowInput[] = input.windows.map((window) => {
    if (window.scenario_id !== input.scenario.id || window.model_run_id !== input.modelRun.id) {
      throw new Error("Explorer window is not part of the selected production scenario and model run.");
    }
    const base = {
      id: window.id,
      scenarioId: window.scenario_id,
      candidateId: window.candidate_id,
      name: window.name,
      kind: window.kind,
      body: window.body,
      center: [window.center_longitude, window.center_latitude] as [number, number],
      datasetId: window.dataset_id,
      hypothesis: window.operational_hypothesis,
      limitations: window.limitations,
      features: { slope: window.median_slope_deg, rough: window.terrain_roughness_m, relief: window.relative_relief_m },
    };
    if (!window.candidate_id) return base;
    const score = scoresByCandidate.get(window.candidate_id);
    if (!score) throw new Error(`Explorer candidate window ${window.id} has no matching score.`);
    const contributions = contributionsByCandidate.get(window.candidate_id) ?? [];
    if (contributions.length !== 3) throw new Error(`Explorer candidate window ${window.id} has incomplete contributions.`);
    const rankedContributions = contributions.map((contribution) => ({
      featureKey: contribution.feature_key,
      candidateRaw: contribution.candidate_raw_value,
      referenceRaw: contribution.reference_raw_value,
      weightedContribution: contribution.weighted_contribution,
    }));
    const ordered = [...contributions].sort((left, right) => left.weighted_contribution - right.weighted_contribution);
    return {
      ...base,
      rank: score.rank,
      score: score.similarity_score,
      coverage: score.data_coverage,
      contributions: rankedContributions,
      strongest: ordered[0].feature_key,
      mismatch: ordered.at(-1)?.feature_key,
    };
  });

  const datasets: DatasetInfo[] = input.datasets.map((dataset) => ({
    id: dataset.id,
    short: `${dataset.product} ${dataset.version}`,
    provider: dataset.provider,
    resolution: typeof dataset.native_resolution === "object" ? JSON.stringify(dataset.native_resolution) : String(dataset.native_resolution),
    unit: dataset.unit,
    license: "See dataset provenance.",
    citation: dataset.citation,
    limitations: dataset.limitations,
  }));

  for (const window of windows) {
    if (!datasets.some((dataset) => dataset.id === window.datasetId)) {
      throw new Error(`Explorer window ${window.id} references an unknown dataset.`);
    }
  }

  return { scenario: input.scenario, modelRun: { ...input.modelRun, modelVersion }, datasets, windows };
}
