import type { ExploreData } from "./types";
import { buildCells } from "./geo";
import { LAYERS } from "./layers";

const FIXTURE_URL = "/data/demo/explore-fixture.json";
const DEFAULT_SCENARIO_ID = "mars-gale-aeolis-palus-v1";

export type ExploreSourceMode = "api" | "fixture";

export function resolveExploreSourceMode(): ExploreSourceMode {
  const raw = process.env.EXPLORER_DATA_SOURCE?.trim().toLowerCase();
  if (raw === "api" || raw === "fixture") return raw;

  throw new Error(
    "Unsupported EXPLORER_DATA_SOURCE. Set it to 'api' for the backend dataset or 'fixture' for the local demo.",
  );
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

function parseExplorePayload(payload: unknown, mode: ExploreSourceMode): ExploreData {
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
        const windows = explorerData.windows ?? [];
        return {
          ...(data as Omit<ExploreData, "meta" | "cells" | "gridRanges">),
          cells: buildCells(windows) as ExploreData["cells"],
          gridRanges: {
            slope: LAYERS.slope.range,
            rough: LAYERS.rough.range,
            relief: LAYERS.relief.range,
          },
          meta: meta as ExploreData["meta"],
        };
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
