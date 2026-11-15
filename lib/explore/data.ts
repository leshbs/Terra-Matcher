import type { FeatureCollection, Point } from "geojson";
import type { ExploreData, WindowData } from "./types";

// Map assets live only in public/layers/ and are declared in its manifest.
// Window text (hypothesis, limitations, contributions) still comes from the demo JSON;
// swap META for the real API route once Anggota 1 exposes it.
const MANIFEST = "/layers/manifest.json";
const META = "/data/demo/explore-fixture.json";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function assertCells(fc: FeatureCollection) {
  if (fc.type !== "FeatureCollection" || !fc.features.length) throw new Error("Layer sel kosong atau bukan FeatureCollection");
  for (const f of fc.features) {
    const p = f.properties as Record<string, unknown> | null;
    if (!p || typeof p.wid !== "string" || ["slope", "rough", "relief"].some((k) => typeof p[k] !== "number")) {
      throw new Error(`Fitur sel tidak valid: ${JSON.stringify(p)?.slice(0, 80)}`);
    }
  }
}

async function loadFixtureExplore(): Promise<ExploreData> {
  const manifest = await getJson<{ modelRunId: string; layers: { id: string; path: string }[]; attribution: string[] }>(MANIFEST);
  const path = (id: string) => {
    const l = manifest.layers.find((x) => x.id === id);
    if (!l) throw new Error(`Layer "${id}" tidak ada di manifest`);
    return l.path;
  };
  const [meta, cells, cands] = await Promise.all([
    getJson<{ data: { datasets: ExploreData["datasets"]; windows: Omit<WindowData, "center" | "pointCount">[] }; meta: { modelRunId: string } }>(META),
    getJson<FeatureCollection>(path("terrain-cells")),
    getJson<FeatureCollection>(path("candidate-markers")),
  ]);
  assertCells(cells);

  const runIds = new Set([manifest.modelRunId, meta.meta.modelRunId, ...cands.features.map((f) => f.properties?.modelRunId)]);
  if (runIds.size !== 1) throw new Error(`Model run tidak konsisten: ${[...runIds].join(", ")}`);

  const windows: WindowData[] = meta.data.windows.map((w) => {
    const f = cands.features.find((x) => x.properties?.id === w.id);
    if (!f) throw new Error(`Jendela ${w.id} tidak ada di candidates.geojson`);
    const p = f.properties!;
    return {
      ...w,
      center: (f.geometry as Point).coordinates as [number, number],
      rank: p.rank, score: p.similarityScore, coverage: p.dataCoverage,
      strongest: p.strongestMatchFeatureKey, mismatch: p.largestMismatchFeatureKey,
      pointCount: cells.features.filter((c) => c.properties?.wid === w.id).length,
    };
  });
  return { datasets: meta.data.datasets, windows, cells, attribution: manifest.attribution, meta: { modelRunId: manifest.modelRunId } };
}

const PRODUCTION_SCENARIO_ID = "mars-gale-aeolis-palus-v1";

export async function loadExplore(): Promise<ExploreData> {
  if (process.env.NEXT_PUBLIC_EXPLORER_DATA_SOURCE === "fixture") {
    return loadFixtureExplore();
  }
  const response = await getJson<{ data: ExploreData; meta: ExploreData["meta"] }>(
    `/api/scenarios/${PRODUCTION_SCENARIO_ID}/explorer`,
  );
  return { ...response.data, meta: response.meta };
}
