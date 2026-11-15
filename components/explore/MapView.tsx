"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Body, CellProps, LayerKey, WindowData } from "@/lib/explore/types";
import { OVERVIEW, buildCells, buildPoints, buildRings, windowBounds } from "@/lib/explore/geo";
import { colorExpression } from "@/lib/explore/layers";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export interface MapApi {
  zoomIn(): void;
  zoomOut(): void;
  fitWindow(id: string): void;
  fitOverview(body: Body): void;
}

interface Props {
  windows: WindowData[];
  body: Body;
  activeWindowId: string | null;
  selectedCellId: string | null;
  layer: LayerKey;
  opacity: number; // 0..1
  panelOpen: boolean; // inspector visible (reserves space when fitting on mobile)
  onReady: (api: MapApi) => void;
  onSelectCell: (cell: CellProps) => void;
  onSelectWindow: (id: string) => void;
  onClearSelection: () => void;
}

const EMPTY = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
const FADE = ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0] as maplibregl.ExpressionSpecification;

export default function MapView(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pr = useRef(props);
  pr.current = props; // handlers always read the latest props
  const [loaded, setLoaded] = useState(false);

  // Create the map once.
  useEffect(() => {
    const el = box.current!;
    // No basemap: the canvas is a plain background; terrain layers are drawn from GeoJSON.
    const map = new maplibregl.Map({
      container: el,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#12161b" } }] },
      bounds: OVERVIEW.mars, fitBoundsOptions: { padding: 40 },
      dragRotate: false, pitchWithRotate: false, maxZoom: 12, minZoom: 0.8,
      attributionControl: { compact: true, customAttribution: "NASA PDS Geosciences Node (MOLA MEGDR v2, CC0) · NASA LP DAAC (NASADEM V001)" },
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    const pad = () => (el.clientWidth > 800
      ? { top: 50, bottom: 50, left: 60, right: 380 }
      : { top: 40, bottom: Math.round(el.clientHeight * (pr.current.panelOpen ? 0.5 : 0.1)), left: 30, right: 30 });

    map.on("load", () => {
      for (const n of ["cells", "wins", "rings"]) map.addSource(n, { type: "geojson", data: EMPTY });
      map.addLayer({ id: "cells-fill", type: "fill", source: "cells", paint: { "fill-color": colorExpression(pr.current.layer), "fill-opacity": pr.current.opacity } });
      map.addLayer({ id: "cells-line", type: "line", source: "cells", minzoom: 6, paint: { "line-color": "rgba(0,0,0,.35)", "line-width": 0.6 } });
      map.addLayer({ id: "rings", type: "line", source: "rings", paint: { "line-color": "rgba(255,255,255,.55)", "line-width": 1.2, "line-dasharray": [3, 2] } });
      map.addLayer({ id: "cell-sel", type: "line", source: "cells", filter: ["==", ["get", "id"], ""], paint: { "line-color": "#fff", "line-width": 3 } });
      map.addLayer({ id: "win-sel", type: "circle", source: "wins", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#fff", "circle-stroke-width": 2, "circle-opacity": FADE, "circle-stroke-opacity": FADE } });
      map.addLayer({ id: "win-pts", type: "circle", source: "wins", paint: { "circle-radius": 7, "circle-color": ["match", ["get", "body"], "mars", "#e0693f", "#2fb5a8"], "circle-stroke-color": "#fff", "circle-stroke-width": 2, "circle-opacity": FADE, "circle-stroke-opacity": FADE } });
      props.onReady({
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
        fitWindow: (id) => { const w = pr.current.windows.find((x) => x.id === id); if (w) map.fitBounds(windowBounds(w), { padding: pad(), duration: 900 }); },
        fitOverview: (b) => map.fitBounds(OVERVIEW[b], { padding: { top: 40, bottom: 40, left: 40, right: el.clientWidth > 800 ? 360 : 40 }, duration: 900 }),
      });
      setLoaded(true);
    });

    const hit = (p: maplibregl.PointLike, layers: string[], r = 0) => {
  const present = layers.filter((l) => map.getLayer(l)); // layers exist only after "load"
  if (!present.length) return [];
  const { x, y } = maplibregl.Point.convert(p);
  return map.queryRenderedFeatures(r ? [[x - r, y - r], [x + r, y + r]] : [x, y], { layers: present });
};
    map.on("click", (e) => {
      if (map.getZoom() < 8.5) {
        const w = hit(e.point, ["win-pts"], 9);
        if (w.length) return pr.current.onSelectWindow(String(w[0].properties.id));
      }
      const c = hit(e.point, ["cells-fill"]);
      if (c.length) return pr.current.onSelectCell(c[0].properties as unknown as CellProps);
      pr.current.onClearSelection();
    });
    map.on("mousemove", (e) => { map.getCanvas().style.cursor = hit(e.point, ["win-pts", "cells-fill"], 9).length ? "pointer" : ""; });

    return () => { map.remove(); mapRef.current = null; setLoaded(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sources follow the selected body.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !loaded) return;
    const ws = props.windows.filter((w) => w.body === props.body);
    (m.getSource("cells") as maplibregl.GeoJSONSource).setData(buildCells(ws));
    (m.getSource("wins") as maplibregl.GeoJSONSource).setData(buildPoints(ws));
    (m.getSource("rings") as maplibregl.GeoJSONSource).setData(buildRings(ws));
  }, [loaded, props.windows, props.body]);

  useEffect(() => { if (loaded) mapRef.current!.setPaintProperty("cells-fill", "fill-color", colorExpression(props.layer)); }, [loaded, props.layer]);
  useEffect(() => { if (loaded) mapRef.current!.setPaintProperty("cells-fill", "fill-opacity", props.opacity); }, [loaded, props.opacity]);
  useEffect(() => {
    if (!loaded) return;
    const m = mapRef.current!;
    m.setFilter("cell-sel", ["==", ["get", "id"], props.selectedCellId ?? ""]);
    m.setFilter("win-sel", ["==", ["get", "id"], props.activeWindowId ?? ""]);
  }, [loaded, props.selectedCellId, props.activeWindowId]);

  return <div ref={box} style={{ position: "absolute", inset: 0 }} />;
}
