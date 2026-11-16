import type { ExploreData } from "./types";
import { resolveDataSourceMode } from "@/lib/source-mode";

const FIXTURE_URL = "/data/demo/explore-fixture.json";
const FIXTURE_MANIFEST_URL = "/layers/manifest.json";
const FIXTURE_CELLS_URL = "/layers/terrain-cells.geojson";
const FIXTURE_CANDIDATES_URL = "/layers/candidates.geojson";
const DEFAULT_SCENARIO_ID = "mars-gale-aeolis-palus-v1";

export type ExploreSourceMode = "api" | "fixture";

export function resolveExploreSourceMode(): ExploreSourceMode {
  return resolveDataSourceMode({
    value: process.env.EXPLORER_DATA_SOURCE,
    environment: process.env.NODE_ENV,
    variableName: "EXPLORER_DATA_SOURCE",
  });
}

export function resolveExploreApiUrl(scenarioId: string): string {
  return `/api/scenarios/${encodeURIComponent(scenarioId)}/explorer`;
}

function hasCanonicalGrid(data: Partial<ExploreData>): data is ExploreData {
  const cells = data.cells;
  const ranges = data.gridRanges;
  return (
    cells?.type === "FeatureCollection" &&
    Array.isArray(cells.features) &&
    ranges !== undefined &&
    (["slope", "rough", "relief"] as const).every((key) => {
      const range = ranges[key];
      return Array.isArray(range) && range.length === 2 && range.every(Number.isFinite);
    })
  );
}

function gridRangesFromCells(cells: ExploreData["cells"]): ExploreData["gridRanges"] {
  const range = (key: "slope" | "rough" | "relief"): [number, number] => {
    const values = cells.features.map((cell) => Number(cell.properties?.[key]));
    return [Math.min(...values), Math.max(...values)];
  };
  return { slope: range("slope"), rough: range("rough"), relief: range("relief") };
}

async function loadFixturePayload(payload: { data: unknown; meta: unknown }): Promise<ExploreData> {
  const [manifestResponse, cellsResponse, candidatesResponse] = await Promise.all([
    fetch(FIXTURE_MANIFEST_URL, { cache: "no-store" }),
    fetch(FIXTURE_CELLS_URL, { cache: "no-store" }),
    fetch(FIXTURE_CANDIDATES_URL, { cache: "no-store" }),
  ]);
  if (![manifestResponse, cellsResponse, candidatesResponse].every((response) => response.ok)) {
    throw new Error("Explorer fixture layers could not be loaded.");
  }
  const [manifest, cells, candidates] = await Promise.all([
    manifestResponse.json() as Promise<{ modelRunId: string; attribution: string[] }>,
    cellsResponse.json() as Promise<ExploreData["cells"]>,
    candidatesResponse.json() as Promise<{ features: Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> }>,
  ]);
  const source = payload.data as { datasets: ExploreData["datasets"]; windows: Array<Omit<ExploreData["windows"][number], "center" | "points">> };
  const windows = source.windows.map((window) => {
    const marker = candidates.features.find((feature) => feature.properties?.id === window.id);
    if (marker?.geometry?.type !== "Point" || !Array.isArray(marker.geometry.coordinates)) {
      throw new Error(`Explorer fixture marker is missing for ${window.id}.`);
    }
    const points = cells.features.filter((cell) => cell.properties?.wid === window.id).map((cell) => ({
      e: Number(cell.properties?.e), n: Number(cell.properties?.n), slope: Number(cell.properties?.slope),
      rough: Number(cell.properties?.rough), relief: Number(cell.properties?.relief),
    }));
    return { ...window, center: marker.geometry.coordinates as [number, number], points };
  });
  return {
    datasets: source.datasets, windows, cells, gridRanges: gridRangesFromCells(cells),
    attribution: manifest.attribution, meta: { modelRunId: manifest.modelRunId },
  };
}

async function parseExplorePayload(payload: unknown, mode: ExploreSourceMode): Promise<ExploreData> {
  if (payload !== null && typeof payload === "object" && "data" in payload && "meta" in payload) {
    const { data, meta } = payload as { data: unknown; meta: unknown };
    if (
      data !== null && typeof data === "object" && "datasets" in data && "windows" in data &&
      Array.isArray((data as { windows: unknown }).windows) &&
      meta !== null && typeof meta === "object" &&
      typeof (meta as { modelRunId?: unknown }).modelRunId === "string"
    ) {
      const explorerData = data as Partial<ExploreData>;
      if (hasCanonicalGrid(explorerData)) {
        return { ...(data as Omit<ExploreData, "meta">), meta: meta as ExploreData["meta"] };
      }

      if (mode === "fixture") {
        return loadFixturePayload({ data, meta });
      }
    }
  }

  throw new Error("Explorer API response does not match the UI data contract.");
}

async function fetchExplore(url: string, label: "API" | "fixture", mode: ExploreSourceMode): Promise<ExploreData> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Explorer ${label} could not be reached.${detail}`);
  }

  if (!response.ok) throw new Error(`Explorer ${label} returned HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Explorer ${label} response was not valid JSON.`);
  }

  return parseExplorePayload(payload, mode);
}

/** API failures never substitute demo data, so production failures stay visible. */
export async function loadExplore(options?: { scenarioId?: string }): Promise<ExploreData> {
  const mode = resolveExploreSourceMode();
  const scenarioId = options?.scenarioId?.trim() || DEFAULT_SCENARIO_ID;
  if (mode === "fixture") return fetchExplore(FIXTURE_URL, "fixture", mode);
  return fetchExplore(resolveExploreApiUrl(scenarioId), "API", mode);
}
