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

  return context;
}
