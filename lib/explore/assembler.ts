import type { FeatureCollection } from "geojson";
import type { DatasetInfo, ExploreData, WindowData } from "./types";

const KM_PER_DEG = { mars: 59.27, earth: 111.19 } as const;

export type ExplorerWindowInput = Omit<WindowData, "pointCount" | "rank" | "score" | "coverage" | "contributions" | "strongest" | "mismatch"> & {
  scenarioId: string;
  candidateId: string | null;
  rank?: number;
  score?: number;
  coverage?: number;
  contributions?: WindowData["contributions"];
  strongest?: string;
  mismatch?: string;
};

export type ExplorerSampleInput = {
  id: string;
  windowId: string;
  modelRunId: string;
  eastKm: number;
  northKm: number;
  slope: number;
  roughness: number;
  relief: number;
};

type ExplorerContext = {
  scenario: { id: string };
  modelRun: { id: string; modelVersion: string };
  datasets: DatasetInfo[];
  windows: ExplorerWindowInput[];
  attribution?: string[];
};

function cellGeometry(window: WindowData, sample: ExplorerSampleInput) {
  const kmPerDegree = KM_PER_DEG[window.body];
  const longitudeScale = kmPerDegree * Math.cos((window.center[1] * Math.PI) / 180);
  const point = (eastKm: number, northKm: number): [number, number] => [
    window.center[0] + eastKm / longitudeScale,
    window.center[1] + northKm / kmPerDegree,
  ];
  const halfCellKm = 2;
  return [
    point(sample.eastKm - halfCellKm, sample.northKm - halfCellKm),
    point(sample.eastKm + halfCellKm, sample.northKm - halfCellKm),
    point(sample.eastKm + halfCellKm, sample.northKm + halfCellKm),
    point(sample.eastKm - halfCellKm, sample.northKm + halfCellKm),
    point(sample.eastKm - halfCellKm, sample.northKm - halfCellKm),
  ];
}

export function assembleExplorerDataset(
  context: ExplorerContext,
  samples: ExplorerSampleInput[],
): { data: Omit<ExploreData, "meta">; meta: ExploreData["meta"] & { modelVersion: string; dataMode: "production" } } {
  const samplesByWindow = new Map<string, ExplorerSampleInput[]>();
  for (const sample of samples) {
    if (sample.modelRunId !== context.modelRun.id) {
      throw new Error("Explorer sample model run does not match the selected model run.");
    }
    const group = samplesByWindow.get(sample.windowId) ?? [];
    group.push(sample);
    samplesByWindow.set(sample.windowId, group);
  }

  const cells: FeatureCollection = { type: "FeatureCollection", features: [] };
  const windows = context.windows.map((window) => {
    if (window.scenarioId !== context.scenario.id) {
      throw new Error("Explorer window does not belong to the requested scenario.");
    }
    const points = samplesByWindow.get(window.id) ?? [];
    if (points.length !== 25) {
      throw new Error(`Explorer window ${window.id} must have exactly 25 samples.`);
    }
    const resolvedWindow = {
      ...window,
      pointCount: points.length,
    } satisfies WindowData;
    cells.features.push(...points.map((sample) => ({
      type: "Feature" as const,
      properties: {
        id: sample.id,
        wid: resolvedWindow.id,
        e: sample.eastKm,
        n: sample.northKm,
        slope: sample.slope,
        rough: sample.roughness,
        relief: sample.relief,
        lon: resolvedWindow.center[0] + sample.eastKm / (KM_PER_DEG[resolvedWindow.body] * Math.cos((resolvedWindow.center[1] * Math.PI) / 180)),
        lat: resolvedWindow.center[1] + sample.northKm / KM_PER_DEG[resolvedWindow.body],
      },
      geometry: { type: "Polygon" as const, coordinates: [cellGeometry(resolvedWindow, sample)] },
    })));
    return resolvedWindow;
  });

  return {
    data: {
      datasets: Object.fromEntries(context.datasets.map((dataset) => [dataset.id, dataset])),
      windows,
      cells,
      attribution: context.attribution ?? [],
    },
    meta: {
      modelRunId: context.modelRun.id,
      modelVersion: context.modelRun.modelVersion,
      dataMode: "production",
    },
  };
}
