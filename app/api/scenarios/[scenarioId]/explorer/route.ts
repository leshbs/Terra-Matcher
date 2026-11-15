import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { assembleExplorerDataset } from "@/lib/explore/assembler";
import { buildExplorerContext } from "@/lib/explore/production";

const scenarioIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
type RouteContext = { params: Promise<{ scenarioId: string }> };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { scenarioId } = await context.params;
  if (!scenarioIdSchema.safeParse(scenarioId).success) return error(400, "INVALID_SCENARIO_ID", "Scenario ID is invalid.");
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const { data: scenario, error: scenarioError } = await supabaseServer.from("scenarios").select("id, data_mode").eq("id", scenarioId).maybeSingle();
    if (scenarioError) throw scenarioError;
    if (!scenario) return error(404, "SCENARIO_NOT_FOUND", "Scenario was not found.");
    if (scenario.data_mode !== "production") return error(409, "MODEL_RUN_UNAVAILABLE", "Explorer is available only for a production scenario.");

    const { data: windows, error: windowsError } = await supabaseServer.from("explorer_windows").select("id, scenario_id, candidate_id, model_run_id, body, name, kind, center_longitude, center_latitude, dataset_id, operational_hypothesis, limitations, median_slope_deg, terrain_roughness_m, relative_relief_m").eq("scenario_id", scenarioId);
    if (windowsError) throw windowsError;
    if (!windows?.length) return error(503, "EXPLORER_UNAVAILABLE", "Production terrain windows are unavailable.");
    const runIds = [...new Set(windows.map((window) => window.model_run_id))];
    if (runIds.length !== 1) return error(503, "INVALID_EXPLORER_DATA", "Explorer windows do not share one model run.");
    const [modelRunId] = runIds;
    const [scoresResult, contributionsResult, datasetsResult, samplesResult] = await Promise.all([
      supabaseServer.from("candidate_scores").select("candidate_id, model_version, rank, similarity_score, data_coverage").eq("scenario_id", scenarioId).eq("model_run_id", modelRunId),
      supabaseServer.from("ranking_contributions").select("candidate_id, feature_key, weighted_contribution, candidate_raw_value, reference_raw_value").eq("scenario_id", scenarioId).eq("model_run_id", modelRunId),
      supabaseServer.from("datasets").select("id, provider, product, version, native_resolution, unit, citation, limitations"),
      supabaseServer.from("explorer_grid_samples").select("id, window_id, model_run_id, dataset_id, offset_east_km, offset_north_km, slope, roughness, relative_relief").eq("model_run_id", modelRunId),
    ]);
    if (scoresResult.error || contributionsResult.error || datasetsResult.error || samplesResult.error) throw new Error("Explorer production query failed.");
    const production = buildExplorerContext({ scenario: { id: scenarioId }, modelRun: { id: modelRunId }, windows: windows as never[], scores: scoresResult.data ?? [], contributions: contributionsResult.data ?? [], datasets: datasetsResult.data ?? [] });
    const response = assembleExplorerDataset(production, (samplesResult.data ?? []).map((sample) => ({ id: sample.id, windowId: sample.window_id, modelRunId: sample.model_run_id, eastKm: sample.offset_east_km, northKm: sample.offset_north_km, slope: sample.slope, roughness: sample.roughness, relief: sample.relative_relief })));
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("[api/scenario-explorer] Production Explorer query failed.", caught);
    return error(503, "INVALID_EXPLORER_DATA", "Production terrain data could not be validated.");
  }
}
