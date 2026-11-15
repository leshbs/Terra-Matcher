import type { ExpressionSpecification } from "maplibre-gl";
import type { LayerKey } from "./types";

export const LAYERS: Record<LayerKey, { label: string; unit: string; description: string; range: [number, number]; colors: string[] }> = {
  slope: { label: "Median slope", unit: "°", description: "Median slope, 3 km local window", range: [0, 12], colors: ["#fff3c4", "#fdc15b", "#f2793a", "#c93a2a", "#6e1423"] },
  rough: { label: "Terrain roughness", unit: "m", description: "Std. dev. of elevation, 3 km window", range: [0, 250], colors: ["#f3e9f9", "#c8a1e0", "#8e5bbd", "#52308f", "#1d1250"] },
  relief: { label: "Relative relief", unit: "m", description: "Max minus min elevation, 3 km window", range: [0, 800], colors: ["#e3f1f7", "#8fcbd9", "#3c9bb5", "#1f5f8f", "#10264f"] },
};

export const FEATURE_LABELS: Record<string, { label: string; unit: string }> = {
  median_slope_deg: { label: "Median slope", unit: "°" },
  terrain_roughness_m: { label: "Terrain roughness", unit: "m" },
  relative_relief_m: { label: "Relative relief", unit: "m" },
};

export const EXTRA_LIMITATIONS = [
  "Data-derived terrain similarity, not mission-site approval.",
  "MOLA and NASADEM differ in sensing method and vertical reference; only terrain morphology is measured.",
];

export const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format;

export function colorExpression(key: LayerKey): ExpressionSpecification {
  const { range: [lo, hi], colors } = LAYERS[key];
  const stops = colors.flatMap((c, i) => [lo + ((hi - lo) * i) / (colors.length - 1), c]);
  return ["interpolate", ["linear"], ["get", key], ...stops] as ExpressionSpecification;
}
