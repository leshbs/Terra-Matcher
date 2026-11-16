import { connection, NextResponse } from "next/server";
import { assembleComparisonDataset } from "@/lib/comparison/assembler";
import { loadProductionScenario } from "@/lib/scenario-production";

type RouteContext = { params: Promise<{ scenarioId: string }> };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { scenarioId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scenarioId)) return error(400, "INVALID_SCENARIO_ID", "Scenario ID is invalid.");
  try {
    const production = await loadProductionScenario(scenarioId);
    const data = assembleComparisonDataset(production);
    return NextResponse.json({ data, meta: { dataMode: "production", modelRunId: data.model.modelRunId, modelVersion: data.model.modelVersion } }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Ranking data is unavailable.";
    if (message === "Scenario was not found.") return error(404, "SCENARIO_NOT_FOUND", message);
    const code = /provenance|contribution|profile|ranking/i.test(message) ? "INVALID_PROVENANCE" : "RANKINGS_UNAVAILABLE";
    return error(503, code, "Production ranking is unavailable.");
  }
}
