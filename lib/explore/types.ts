import type { FeatureCollection, Polygon } from "geojson";

export type Body = "mars" | "earth";
export type LayerKey = "slope" | "rough" | "relief";

export interface Point { e: number; n: number; slope: number; rough: number; relief: number }
export interface Contribution { featureKey: string; candidateRaw: number; referenceRaw: number; weightedContribution: number }
export interface WindowData {
  id: string; name: string; kind: string; body: Body;
  center: [number, number]; // [lon, lat]
  datasetId: string; hypothesis: string; limitations: string[];
  features: Record<LayerKey, number>; // window-level values
  points: Point[]; // 25 study points, offsets in km from centre
  rank?: number; score?: number; coverage?: number;
  contributions?: Contribution[]; strongest?: string; mismatch?: string;
}
export interface DatasetInfo {
  id: string; short: string; provider: string; resolution: string; unit: string;
  license: string; citation: string; limitations: string[];
}
export type ExplorerCells = FeatureCollection<Polygon, CellProps>;
export type GridRanges = Record<LayerKey, [number, number]>;

export interface ExploreData {
  datasets: Record<string, DatasetInfo>;
  windows: WindowData[];
  cells: ExplorerCells;
  gridRanges: GridRanges;
  attribution?: string[];
  meta: { modelRunId: string; modelVersion?: string; dataMode?: "production" };
}

/** Properties carried by each GeoJSON cell polygon. */
export interface CellProps { id: string; wid: string; e: number; n: number; slope: number; rough: number; relief: number; lon: number; lat: number }
export type Selection = null | { kind: "window"; id: string } | { kind: "cell"; cell: CellProps };
