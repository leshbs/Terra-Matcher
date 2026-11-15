import { z } from "zod";

const modelRunSchema = z.object({
  id: z.string().min(1),
  analysis_resolution_m: z.number().positive(),
  local_window_km: z.number().positive(),
  transformation_version: z.string().min(1),
  input_dataset_ids: z.array(z.string().min(1)).length(2),
});

const datasetSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  product: z.string().min(1),
  version: z.string().min(1),
  url: z.string().url(),
  access_url: z.string().url(),
  native_resolution: z.record(z.string(), z.unknown()),
  unit: z.string().min(1),
  citation: z.string().min(1),
  limitations: z.array(z.string().min(1)).min(1),
});

export function buildMethodologyResponse(modelRunInput: unknown, datasetsInput: unknown) {
  const modelRun = modelRunSchema.parse(modelRunInput);
  const datasets = z.array(datasetSchema).length(2).parse(datasetsInput);
  const ids = new Set(datasets.map((dataset) => dataset.id));
  for (const datasetId of modelRun.input_dataset_ids) {
    if (!ids.has(datasetId)) throw new Error(`Model run references unavailable dataset: ${datasetId}`);
  }

  return {
    modelRun: {
      id: modelRun.id,
      analysisResolutionM: modelRun.analysis_resolution_m,
      localWindowKm: modelRun.local_window_km,
      transformationVersion: modelRun.transformation_version,
      inputDatasetIds: modelRun.input_dataset_ids,
    },
    datasets: datasets.map((dataset) => ({
      id: dataset.id,
      provider: dataset.provider,
      product: dataset.product,
      version: dataset.version,
      url: dataset.url,
      accessUrl: dataset.access_url,
      nativeResolution: dataset.native_resolution,
      unit: dataset.unit,
      citation: dataset.citation,
      limitations: dataset.limitations,
    })),
    features: [
      { key: "median_slope_deg", name: "Median slope", unit: "degrees", localWindowKm: 3 },
      { key: "terrain_roughness_m", name: "Terrain roughness", unit: "m", localWindowKm: 3 },
      { key: "relative_relief_m", name: "Relative relief", unit: "m", localWindowKm: 3 },
    ],
    limitations: [
      "Data-derived similarity, not mission-site approval.",
      "Terrain similarity does not model gravity, atmospheric conditions, radiation, temperature regime, biological activity, access, safety, regulation, or land permissions.",
    ],
  };
}
