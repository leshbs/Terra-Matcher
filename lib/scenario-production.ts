import { z } from "zod";

const productionContextSchema = z.object({
  scenario: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    body: z.literal("mars"),
    description: z.string().nullable(),
    data_mode: z.enum(["fixture", "production"]),
  }),
  modelRun: z.object({
    id: z.string().min(1),
    status: z.enum(["draft", "ready", "retired"]),
    analysis_resolution_m: z.number().positive(),
    local_window_km: z.number().positive(),
    transformation_version: z.string().min(1),
    input_dataset_ids: z.array(z.string().min(1)).min(1),
  }),
  candidateScores: z.array(z.unknown()),
  contributions: z.array(z.unknown()),
  evidence: z.array(z.unknown()),
  locationProfiles: z.array(z.unknown()),
  datasets: z.array(z.unknown()),
});

export type ProductionScenarioContext = z.infer<typeof productionContextSchema>;

export function validateProductionContext(
  input: unknown,
): ProductionScenarioContext {
  const context = productionContextSchema.parse(input);

  if (context.scenario.data_mode !== "production") {
    throw new Error("Fixture scenario is not production data.");
  }

  if (context.modelRun.status !== "ready") {
    throw new Error("Model run is not ready.");
  }

  const profiles = context.locationProfiles as Array<{ location_kind?: string; location_id?: string }>;
  const scores = context.candidateScores as Array<{ model_run_id?: string; rank?: number; candidate_id?: string }>;
  const contributions = context.contributions as Array<{ model_run_id?: string; candidate_id?: string }>;
  if (profiles.filter((profile) => profile.location_kind === "scenario").length !== 1) {
    throw new Error("Production context requires one scenario profile.");
  }
  if (profiles.filter((profile) => profile.location_kind === "candidate").length !== 5) {
    throw new Error("Production context requires five candidate profiles.");
  }
  if (scores.length !== 5 || scores.some((score, index) => score.rank !== index + 1 || score.model_run_id !== context.modelRun.id)) {
    throw new Error("Candidate ranking is incomplete or uses a different model run.");
  }
  for (const score of scores) {
    if (contributions.filter((item) => item.candidate_id === score.candidate_id && item.model_run_id === context.modelRun.id).length !== 3) {
      throw new Error("Candidate ranking is missing feature contributions.");
    }
  }

  return context;
}

export async function loadProductionScenario(scenarioId: string) {
  const { supabaseServer } = await import("./supabase/server");
  const scenarioResult = await supabaseServer.from("scenarios")
    .select("id, name, body, description, data_mode").eq("id", scenarioId).maybeSingle();
  if (scenarioResult.error) throw new Error("Production scenario is unavailable.");
  if (!scenarioResult.data) throw new Error("Scenario was not found.");
  const modelResult = await supabaseServer.from("model_runs")
    .select("id, status, analysis_resolution_m, local_window_km, transformation_version, input_dataset_ids")
    .eq("status", "ready").maybeSingle();
  if (modelResult.error || !modelResult.data) throw new Error("Model run is not ready.");
  const runId = modelResult.data.id;
  const [candidateScores, contributions, evidence, locationProfiles, datasets] = await Promise.all([
    supabaseServer.from("candidate_scores").select("*").eq("scenario_id", scenarioId).eq("model_run_id", runId).order("rank"),
    supabaseServer.from("ranking_contributions").select("*").eq("scenario_id", scenarioId).eq("model_run_id", runId),
    supabaseServer.from("location_evidence").select("*").eq("model_run_id", runId),
    supabaseServer.from("location_profiles").select("*").eq("model_run_id", runId),
    supabaseServer.from("datasets").select("*"),
  ]);
  if ([candidateScores, contributions, evidence, locationProfiles, datasets].some((result) => result.error)) {
    throw new Error("Production provenance is unavailable.");
  }
  return validateProductionContext({ scenario: scenarioResult.data, modelRun: modelResult.data, candidateScores: candidateScores.data ?? [], contributions: contributions.data ?? [], evidence: evidence.data ?? [], locationProfiles: locationProfiles.data ?? [], datasets: datasets.data ?? [] });
}
