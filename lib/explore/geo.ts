import type { FeatureCollection } from "geojson";
import type { Body, WindowData } from "./types";

/** km per degree of latitude. Mars: equatorial radius 3396.19 km. Earth: mean radius 6371 km.
 *  Confirm with the data owner that the pipeline used the same offset convention. */
export const KM_PER_DEG: Record<Body, number> = { mars: 59.27, earth: 111.19 };
export const CELL_KM = 4; // study points are 4 km apart
export const RADIUS_KM = 20;
export const OVERVIEW: Record<Body, [[number, number], [number, number]]> = {
  mars: [[100, -35], [175, 25]],
  earth: [[-170, -35], [50, 52]],
};

export function offset(w: WindowData, eKm: number, nKm: number): [number, number] {
  const kd = KM_PER_DEG[w.body];
  const [lon, lat] = w.center;
  return [+(lon + eKm / (kd * Math.cos((lat * Math.PI) / 180))).toFixed(5), +(lat + nKm / kd).toFixed(5)];
}

export function windowBounds(w: WindowData): [[number, number], [number, number]] {
  return [offset(w, -RADIUS_KM, -RADIUS_KM), offset(w, RADIUS_KM, RADIUS_KM)];
}

export function buildCells(ws: WindowData[]): FeatureCollection {
  const h = CELL_KM / 2;
  return {
    type: "FeatureCollection",
    features: ws.flatMap((w) => w.points.map((p) => {
      const [lon, lat] = offset(w, p.e, p.n);
      return {
        type: "Feature" as const,
        properties: { id: `${w.id}:e${p.e}n${p.n}`, wid: w.id, e: p.e, n: p.n, slope: p.slope, rough: p.rough, relief: p.relief, lon, lat },
        geometry: { type: "Polygon" as const, coordinates: [[offset(w, p.e - h, p.n - h), offset(w, p.e + h, p.n - h), offset(w, p.e + h, p.n + h), offset(w, p.e - h, p.n + h), offset(w, p.e - h, p.n - h)]] },
      };
    })),
  };
}

export function buildPoints(ws: WindowData[]): FeatureCollection {
  return { type: "FeatureCollection", features: ws.map((w) => ({ type: "Feature" as const, properties: { id: w.id, body: w.body }, geometry: { type: "Point" as const, coordinates: w.center } })) };
}

export function buildRings(ws: WindowData[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: ws.map((w) => ({
      type: "Feature" as const, properties: { id: w.id },
      geometry: { type: "Polygon" as const, coordinates: [Array.from({ length: 65 }, (_, i) => offset(w, RADIUS_KM * Math.cos((i / 64) * 2 * Math.PI), RADIUS_KM * Math.sin((i / 64) * 2 * Math.PI)))] },
    })),
  };
}
