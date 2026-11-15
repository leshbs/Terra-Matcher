import type { Feature } from "geojson";
import type {
  ExplorerAssemblyContext,
  ExplorerSampleInput,
} from "./contracts";
import type { CellProps, ExploreData, GridRanges, LayerKey, Point, WindowData } from "./types";

const KM_PER_DEGREE = { mars: 59.27, earth: 111.19 } as const;
const SAMPLE_COUNT = 25;

function pointCoordinates(window: WindowData, eastKm: number, northKm: number): [number, number] {
  const kmPerDegree = KM_PER_DEGREE[window.body];
  return [
    window.center[0] + eastKm / (kmPerDegree * Math.cos(window.center[1] * Math.PI / 180)),
    window.center[1] + northKm / kmPerDegree,
  ];
}

function cellFeature(window: WindowData, sample: ExplorerSampleInput): Feature<GeoJSON.Polygon, CellProps> {
  const halfCellKm = 2;
  const southwest = pointCoordinates(window, sample.eastKm - halfCellKm, sample.northKm - halfCellKm);
  const southeast = pointCoordinates(window, sample.eastKm + halfCellKm, sample.northKm - halfCellKm);
  const northeast = pointCoordinates(window, sample.eastKm + halfCellKm, sample.northKm + halfCellKm);
  const northwest = pointCoordinates(window, sample.eastKm - halfCellKm, sample.northKm + halfCellKm);
  const [lon, lat] = pointCoordinates(window, sample.eastKm, sample.northKm);

  return {
    type: "Feature",
    properties: {
      id: sample.id,
      wid: window.id,
      e: sample.eastKm,
      n: sample.northKm,
      slope: sample.slope,
      rough: sample.roughness,
      relief: sample.relief,
      lon,
      lat,
    },
    geometry: { type: "Polygon", coordinates: [[southwest, southeast, northeast, northwest, southwest]] },
  };
}

function deriveGridRanges(points: Point[]): GridRanges {
  const range = (key: LayerKey): [number, number] => {
    const values = points.map((point) => point[key]);
    return [Math.min(...values), Math.max(...values)];
  };
  return { slope: range("slope"), rough: range("rough"), relief: range("relief") };
}

export function assembleExplorerDataset(
  context: ExplorerAssemblyContext,
  samples: ExplorerSampleInput[],
): { data: Omit<ExploreData, "meta">; meta: ExploreData["meta"] } {
  if (context.modelRun.status !== "ready") {
    throw new Error("Model run is not ready.");
  }

  const windowIds = new Set(context.windows.map((window) => window.id));
  const samplesByWindow = new Map<string, ExplorerSampleInput[]>();
  for (const sample of samples) {
    if (sample.modelRunId !== context.modelRun.id) {
      throw new Error("Explorer sample model run does not match the selected model run.");
    }
    if (!windowIds.has(sample.windowId)) {
      throw new Error("Explorer sample does not belong to the selected explorer context.");
    }
    const windowSamples = samplesByWindow.get(sample.windowId) ?? [];
    windowSamples.push(sample);
    samplesByWindow.set(sample.windowId, windowSamples);
  }

  const cells: ExploreData["cells"] = { type: "FeatureCollection", features: [] };
  const points: Point[] = [];
  const windows = context.windows.map((window) => {
    if (window.scenarioId !== context.scenario.id) {
      throw new Error("Explorer window does not belong to the requested scenario.");
    }
    const windowSamples = samplesByWindow.get(window.id) ?? [];
    if (windowSamples.length !== SAMPLE_COUNT) {
      throw new Error(`Explorer window ${window.id} must have exactly ${SAMPLE_COUNT} samples.`);
    }
    if (windowSamples.some((sample) => sample.datasetId !== window.datasetId)) {
      throw new Error(`Explorer samples for ${window.id} must use the window dataset.`);
    }
    const windowPoints = windowSamples.map<Point>((sample) => ({
      e: sample.eastKm,
      n: sample.northKm,
      slope: sample.slope,
      rough: sample.roughness,
      relief: sample.relief,
    }));
    points.push(...windowPoints);
    const resolvedWindow: WindowData = { ...window, points: windowPoints };
    cells.features.push(...windowSamples.map((sample) => cellFeature(resolvedWindow, sample)));
    return resolvedWindow;
  });

  return {
    data: {
      datasets: Object.fromEntries(context.datasets.map((dataset) => [dataset.id, dataset])),
      windows,
      cells,
      gridRanges: deriveGridRanges(points),
      attribution: context.attribution,
    },
    meta: {
      modelRunId: context.modelRun.id,
      modelVersion: context.modelRun.modelVersion,
      dataMode: "production",
    },
  };
}
