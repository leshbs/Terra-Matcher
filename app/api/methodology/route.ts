import { connection, NextResponse } from "next/server";
import { buildMethodologyResponse } from "@/lib/methodology";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const ACTIVE_MODEL_RUN_ID = "2026-11-14-mvp-v1";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function unavailable() {
  return NextResponse.json(
    {
      error: {
        code: "METHODOLOGY_UNAVAILABLE",
        message: "Methodology data is temporarily unavailable.",
      },
    },
    { status: 503, headers: NO_STORE },
  );
}

export async function GET() {
  await connection();

  try {
    const supabase = createPublicSupabaseClient();

    const { data: modelRun, error: modelRunError } = await supabase
      .from("model_runs")
      .select("id, analysis_resolution_m, local_window_km, transformation_version, input_dataset_ids")
      .eq("id", ACTIVE_MODEL_RUN_ID)
      .maybeSingle();

    if (modelRunError || !modelRun) {
      return unavailable();
    }

    const inputDatasetIds: string[] = Array.isArray(modelRun.input_dataset_ids)
  ? (modelRun.input_dataset_ids as string[])
  : [];

    if (inputDatasetIds.length === 0) {
      return unavailable();
    }

    const { data: datasets, error: datasetError } = await supabase
      .from("datasets")
      .select("id, provider, product, version, url, access_url, native_resolution, unit, citation, limitations")
      .in("id", inputDatasetIds);

    if (datasetError || !datasets || datasets.length !== inputDatasetIds.length) {
      return unavailable();
    }

    const datasetsById = new Map(
      datasets.map((dataset) => [dataset.id, dataset] as const),
    );

    const orderedDatasets = inputDatasetIds.flatMap((id) => {
      const dataset = datasetsById.get(id);
      return dataset ? [dataset] : [];
    });

    return NextResponse.json(buildMethodologyResponse(modelRun, orderedDatasets), {
      headers: NO_STORE,
    });
  } catch {
    return unavailable();
  }
}
