import type { ExploreData } from "./types";

/** Swap this URL for the real Route Handler once Anggota 1 exposes per-window points.
 *  Expected envelope: { data: { datasets, windows }, meta: { modelRunId } } */
const SOURCE = "/data/demo/explore-fixture.json";

export async function loadExplore(): Promise<ExploreData> {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Failed to load ${SOURCE} (${res.status})`);
  const { data, meta } = await res.json();
  return { ...data, meta };
}
