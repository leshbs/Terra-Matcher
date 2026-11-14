import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { connection } from "next/server";

const scenarioRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.string().min(1),
  description: z.string().nullable(),
  data_mode: z.enum(["fixture", "production"]),
});

const scenarioRowsSchema = z.array(scenarioRowSchema);

function errorResponse(code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  await connection();

  try {
    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase
      .from("scenarios")
      .select("id, name, body, description, data_mode")
      .order("id", { ascending: true });

    if (error) {
      // Do not expose raw database errors or configuration to clients.
      console.error("[api/scenarios] Supabase query failed.", {
  code: error.code,
  message: error.message,
  hint: error.hint,
});
      return errorResponse(
        "SCENARIOS_UNAVAILABLE",
        "Scenario data is temporarily unavailable.",
      );
    }

    const parsed = scenarioRowsSchema.safeParse(data);

    if (!parsed.success) {
      console.error("[api/scenarios] Database response failed validation.");
      return errorResponse(
        "INVALID_SCENARIO_DATA",
        "Scenario data could not be validated.",
      );
    }

    const scenarios = parsed.data.map((row) => ({
      id: row.id,
      name: row.name,
      body: row.body,
      description: row.description,
      dataMode: row.data_mode,
    }));

    return NextResponse.json(
      { scenarios },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[api/scenarios] Request could not be completed.");
    return errorResponse(
      "SCENARIOS_UNAVAILABLE",
      "Scenario data is temporarily unavailable.",
    );
  }
}