import type { DatasetInfo, WindowData } from "./types";

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
