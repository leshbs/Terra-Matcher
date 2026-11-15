import { connection, NextResponse } from "next/server";
import { buildMethodologyResponse } from "@/lib/methodology";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const ACTIVE_MODEL_RUN_ID = "2026-11-14-mvp-v1";

export async function GET() {
  await connection();

  try {
    const supabase = createPublicSupabaseClient();
    const { data: modelRun, error: modelRunError } = await supabase
      .from("model_runs")
      .select("id, analysis_resolution_m, local_window_km, transformation_version, input_dataset_ids")
      .eq("id", ACTIVE_MODEL_RUN_ID)
      .maybeSingle();

    const { data: datasets, error: datasetError } = await supabase
      .from("datasets")
      .select("id, provider, product, version, url, access_url, native_resolution, unit, citation, limitations")
      .order("id", { ascending: true });

    if (modelRunError || datasetError || !modelRun) {
      return NextResponse.json({ error: { code: "METHODOLOGY_UNAVAILABLE", message: "Methodology data is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(buildMethodologyResponse(modelRun, datasets ?? []), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "METHODOLOGY_UNAVAILABLE", message: "Methodology data is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
