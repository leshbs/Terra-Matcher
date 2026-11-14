import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

// Explicit fixture selection. Never use this run for production data.
const FIXTURE_SCENARIO_ID = "mars-reference-fixture-v1";
const FIXTURE_RUN_ID = "fixture-run-v1";
const FIXTURE_MODEL_VERSION = "fixture-demo-v1";
const MAX_RESULTS = 1000;

const scenarioIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.string().min(1),
  description: z.string().nullable(),
  data_mode: z.enum(["fixture", "production"]),
});

const candidateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    country: z.string().nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    source: z.string().min(1),
  })
  .refine(
    (row) => (row.latitude === null) === (row.longitude === null),
    { message: "Coordinates must both be present or both be null." },
  );

const scoreSchema = z.object({
  model_run_id: z.literal(FIXTURE_RUN_ID),
  model_version: z.literal(FIXTURE_MODEL_VERSION),
  scenario_id: z.literal(FIXTURE_SCENARIO_ID),
  candidate_id: z.string().min(1),
  median_slope_deg: z.number().min(0).max(90),
  terrain_roughness_m: z.number().min(0),
  relative_relief_m: z.number().min(0),
  similarity_score: z.number().min(0).max(1),
  generated_at: z.iso.datetime({ offset: true }),
  candidates: candidateSchema,
});

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status);
}

type RouteContext = {
  params: Promise<{ scenarioId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  await connection();

  try {
    const { scenarioId } = await context.params;

    if (!scenarioIdSchema.safeParse(scenarioId).success) {
      return errorResponse(
        400,
        "INVALID_SCENARIO_ID",
        "Scenario ID is invalid.",
      );
    }

    const supabase = createPublicSupabaseClient();

    const scenarioResult = await supabase
      .from("scenarios")
      .select("id, name, body, description, data_mode")
      .eq("id", scenarioId)
      .maybeSingle();

    if (scenarioResult.error) {
      console.error("[api/scenario-candidates] Scenario query failed.");
      return errorResponse(
        503,
        "CANDIDATES_UNAVAILABLE",
        "Candidate data is temporarily unavailable.",
      );
    }

    if (scenarioResult.data === null) {
      return errorResponse(
        404,
        "SCENARIO_NOT_FOUND",
        "Scenario was not found.",
      );
    }

    const scenarioParsed = scenarioSchema.safeParse(scenarioResult.data);

    if (!scenarioParsed.success) {
      return errorResponse(
        503,
        "INVALID_SCENARIO_DATA",
        "Scenario data could not be validated.",
      );
    }

    const scenario = scenarioParsed.data;

    if (
      scenario.id !== FIXTURE_SCENARIO_ID ||
      scenario.data_mode !== "fixture"
    ) {
      return errorResponse(
        503,
        "MODEL_RUN_UNAVAILABLE",
        "No supported model run is configured for this scenario.",
      );
    }

    // The foreign key makes candidates a to-one embedded relationship.
    // Avoid an inner join: a missing candidate must fail validation,
    // not silently remove a score row.
    const scoreResult = await supabase
      .from("candidate_scores")
      .select(`
        model_run_id,
        model_version,
        scenario_id,
        candidate_id,
        median_slope_deg,
        terrain_roughness_m,
        relative_relief_m,
        similarity_score,
        generated_at,
        candidates (
          id,
          name,
          country,
          latitude,
          longitude,
          source
        )
      `)
      .eq("scenario_id", scenarioId)
      .eq("model_run_id", FIXTURE_RUN_ID)
      .order("similarity_score", { ascending: false, nullsFirst: false })
      .order("candidate_id", { ascending: true })
      .limit(MAX_RESULTS + 1);

    if (scoreResult.error) {
      console.error("[api/scenario-candidates] Score query failed.");
      return errorResponse(
        503,
        "CANDIDATES_UNAVAILABLE",
        "Candidate data is temporarily unavailable.",
      );
    }

    const scoresParsed = z
      .array(scoreSchema)
      .min(1)
      .max(MAX_RESULTS)
      .safeParse(scoreResult.data);

    if (
      !scoresParsed.success ||
      scoresParsed.data.some(
        (row) => row.candidate_id !== row.candidates.id,
      )
    ) {
      console.error("[api/scenario-candidates] Score validation failed.");
      return errorResponse(
        503,
        "INVALID_CANDIDATE_DATA",
        "Candidate data is missing or could not be validated.",
      );
    }

    const candidates = scoresParsed.data.map((row) => ({
      id: row.candidates.id,
      name: row.candidates.name,
      country: row.candidates.country,
      latitude: row.candidates.latitude,
      longitude: row.candidates.longitude,
      source: row.candidates.source,
      features: {
        medianSlopeDeg: row.median_slope_deg,
        terrainRoughnessM: row.terrain_roughness_m,
        relativeReliefM: row.relative_relief_m,
      },
      similarityScore: row.similarity_score,
      generatedAt: row.generated_at,
    }));

    return jsonResponse({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        body: scenario.body,
        description: scenario.description,
      },
      dataMode: scenario.data_mode,
      modelRunId: FIXTURE_RUN_ID,
      modelVersion: FIXTURE_MODEL_VERSION,
      limitations: [
        "Synthetic fixture values; terrain features are not measured.",
        "Place names are illustrative; coordinates are not supplied.",
        "Similarity scores are not probabilities or validated analog assessments.",
        "Not a landing-site recommendation; gravity, atmosphere, and radiation are not modeled.",
      ],
      candidates,
    });
  } catch {
    console.error("[api/scenario-candidates] Request could not be completed.");
    return errorResponse(
      503,
      "CANDIDATES_UNAVAILABLE",
      "Candidate data is temporarily unavailable.",
    );
  }
}