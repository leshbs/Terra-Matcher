import { connection, NextResponse } from "next/server";
import { assembleExplorerDataset } from "@/lib/explore/assembler";
import { buildExplorerAssemblyContext, loadExplorerSamples } from "@/lib/explore/production";
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
    const explorerContext = buildExplorerAssemblyContext(production);
    const samples = await loadExplorerSamples(production.modelRun.id, explorerContext.windows.map((window) => window.id));
    const explorer = assembleExplorerDataset(explorerContext, samples);
    return NextResponse.json(explorer, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Explorer data is unavailable.";
    if (message === "Scenario was not found.") return error(404, "SCENARIO_NOT_FOUND", message);
    const code = /profile|sample|grid|contribution|model run|dataset/i.test(message) ? "INVALID_EXPLORER_DATA" : "EXPLORER_UNAVAILABLE";
    return error(503, code, "Production Explorer is unavailable.");
  }
}
