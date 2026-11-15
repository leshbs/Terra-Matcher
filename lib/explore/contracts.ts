import { z } from "zod";
import type { DatasetInfo, WindowData } from "./types";

const finiteNumber = z.number().finite();
const coordinate = z.tuple([finiteNumber, finiteNumber]);
const pointSchema = z.object({
  e: finiteNumber,
  n: finiteNumber,
  slope: finiteNumber,
  rough: finiteNumber,
  relief: finiteNumber,
});

const datasetSchema = z.object({
  id: z.string().min(1),
  short: z.string().min(1),
  provider: z.string().min(1),
  resolution: z.string().min(1),
  unit: z.string().min(1),
  license: z.string().min(1),
  citation: z.string().min(1),
  limitations: z.array(z.string()),
});

const windowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  body: z.enum(["mars", "earth"]),
  center: coordinate,
  datasetId: z.string().min(1),
  hypothesis: z.string(),
  limitations: z.array(z.string()),
  features: z.object({ slope: finiteNumber, rough: finiteNumber, relief: finiteNumber }),
  points: z.array(pointSchema).length(25),
  rank: finiteNumber.optional(),
  score: finiteNumber.optional(),
  coverage: finiteNumber.optional(),
  contributions: z.array(z.object({
    featureKey: z.string().min(1),
    candidateRaw: finiteNumber,
    referenceRaw: finiteNumber,
    weightedContribution: finiteNumber,
  })).optional(),
  strongest: z.string().optional(),
  mismatch: z.string().optional(),
});

const cellPropertiesSchema = z.object({
  id: z.string().min(1),
  wid: z.string().min(1),
  e: finiteNumber,
  n: finiteNumber,
  slope: finiteNumber,
  rough: finiteNumber,
  relief: finiteNumber,
  lon: finiteNumber,
  lat: finiteNumber,
});

const cellFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: cellPropertiesSchema,
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(coordinate).length(5)).length(1),
  }),
});

const rangeSchema = z.tuple([finiteNumber, finiteNumber]).refine(
  ([minimum, maximum]) => minimum <= maximum,
  "Grid range minimum must not exceed its maximum.",
);

/** Runtime contract for the production Explorer route response. */
export const ExplorerApiEnvelopeSchema = z.object({
  data: z.object({
    datasets: z.record(z.string(), datasetSchema),
    windows: z.array(windowSchema),
    cells: z.object({ type: z.literal("FeatureCollection"), features: z.array(cellFeatureSchema) }),
    gridRanges: z.object({ slope: rangeSchema, rough: rangeSchema, relief: rangeSchema }),
    attribution: z.array(z.string()).optional(),
  }),
  meta: z.object({
    modelRunId: z.string().min(1),
    modelVersion: z.string().min(1).optional(),
    dataMode: z.literal("production"),
  }),
}).superRefine((envelope, context) => {
  const windowIds = new Set(envelope.data.windows.map((window) => window.id));
  const cellCounts = new Map<string, number>();

  for (const [index, cell] of envelope.data.cells.features.entries()) {
    cellCounts.set(cell.properties.wid, (cellCounts.get(cell.properties.wid) ?? 0) + 1);
    if (!windowIds.has(cell.properties.wid)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "cells", "features", index, "properties", "wid"],
        message: "Explorer cell must belong to a response window.",
      });
    }
  }

  for (const [index, window] of envelope.data.windows.entries()) {
    const dataset = envelope.data.datasets[window.datasetId];
    if (!dataset || dataset.id !== window.datasetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "windows", index, "datasetId"],
        message: "Explorer window datasetId must resolve to the matching dataset record.",
      });
    }

    if ((cellCounts.get(window.id) ?? 0) !== 25) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", "cells", "features"],
        message: `Explorer window ${window.id} must have exactly 25 cells.`,
      });
    }

    if (window.body === "earth" && window.kind === "candidate") {
      const requiredNumbers = ["rank", "score", "coverage"] as const;
      for (const field of requiredNumbers) {
        if (window[field] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["data", "windows", index, field],
            message: `Earth candidate ${field} is required.`,
          });
        }
      }

      if (window.contributions?.length !== 3) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["data", "windows", index, "contributions"],
          message: "Earth candidate must include exactly three feature contributions.",
        });
      }

      for (const field of ["strongest", "mismatch"] as const) {
        if (!window[field]?.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["data", "windows", index, field],
            message: `Earth candidate ${field} is required.`,
          });
        }
      }
    }
  }
});

export type ExplorerModelRun = {
  id: string;
  status: "draft" | "ready" | "retired";
  modelVersion: string;
};

export type ExplorerWindowInput = Omit<WindowData, "points"> & {
  scenarioId: string;
};

export type ExplorerSampleInput = {
  id: string;
  modelRunId: string;
  windowId: string;
  datasetId: string;
  eastKm: number;
  northKm: number;
  slope: number;
  roughness: number;
  relief: number;
};

export type ExplorerAssemblyContext = {
  scenario: { id: string };
  modelRun: ExplorerModelRun;
  datasets: DatasetInfo[];
  windows: ExplorerWindowInput[];
  attribution?: string[];
};
