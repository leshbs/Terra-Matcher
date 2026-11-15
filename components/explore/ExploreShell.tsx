"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadExplore } from "@/lib/explore/data";
import { LAYERS, fmt } from "@/lib/explore/layers";
import type { Body, CellProps, ExploreData, LayerKey, Selection } from "@/lib/explore/types";
import type { MapApi } from "./MapView";
import Inspector from "./Inspector";
import LayerControl from "./LayerControl";
import s from "./styles";

// maplibre-gl touches `window`, so load the map on the client only.
const MapView = dynamic(() => import("./MapView"), { ssr: false });
const MARS_ID = "mars-gale-aeolis-palus-v1";

export default function ExploreShell() {
  const [data, setData] = useState<ExploreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [body, setBody] = useState<Body>("mars");
  const [winId, setWinId] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>(null);
  const [expanded, setExpanded] = useState(false);
  const [layer, setLayer] = useState<LayerKey>("slope");
  const [opacity, setOpacity] = useState(0.85);
  const [mapVersion, setMapVersion] = useState(0);
  const api = useRef<MapApi | null>(null);
  const winRef = useRef<string | null>(null);
  winRef.current = winId;

  useEffect(() => {
    setError(null);
    loadExplore().then(setData).catch((e: Error) => setError(e.message));
  }, [attempt]);

  const openWindow = useCallback((id: string, fly = true) => {
    const w = data?.windows.find((x) => x.id === id);
    if (!w) return;
    setBody(w.body); setWinId(id); setSel({ kind: "window", id }); setExpanded(false);
    if (fly) api.current?.fitWindow(id);
  }, [data]);

  // First view (and after a map remount): fly to the current or the Mars window.
  useEffect(() => { if (data && mapVersion) openWindow(winRef.current ?? MARS_ID); }, [data, mapVersion, openWindow]);

  const switchBody = (b: Body) => {
    if (b === body) return;
    setBody(b); setWinId(null); setSel(null);
    if (b === "mars") openWindow(MARS_ID); else api.current?.fitOverview(b);
  };
  const overview = () => { setWinId(null); setSel(null); api.current?.fitOverview(body); };
  const reset = () => (winId ? openWindow(winId) : overview());

  const list = (data?.windows ?? []).filter((w) => w.body === body).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const L = LAYERS[layer];

  return (
    <div className={s.root}>
      <div className={s.app}>
        <aside className={s.side}>
          <h1>Terra Analog Explorer</h1>
          <p className={s.sub}>Peta medan interaktif untuk satu skenario Mars dan lima kandidat Bumi.</p>
          <div className={s.seg} role="group" aria-label="Benda langit">
            {(["mars", "earth"] as Body[]).map((b) => (
              <button key={b} className={body === b ? s.on : ""} onClick={() => switchBody(b)}>{b === "mars" ? "Mars" : "Bumi"}</button>
            ))}
          </div>
          <h2 className={s.h2}>Jendela studi (radius 20 km)</h2>
          {!data && !error && <p className={s.sub}>Memuat data peta…</p>}
          {data && list.length === 0 && <p className={s.sub}>Belum ada jendela untuk benda ini.</p>}
          {list.map((w) => (
            <button key={w.id} className={`${s.item} ${winId === w.id ? s.on : ""}`} onClick={() => openWindow(w.id)}>
              <b>{w.name}</b>
              <small>{w.rank ? `#${w.rank} · skor ${fmt(w.score!)}` : "Skenario acuan"} · {w.center[1].toFixed(2)}°, {w.center[0].toFixed(2)}°</small>
            </button>
          ))}
          <LayerControl value={layer} onChange={setLayer} opacity={opacity} onOpacity={setOpacity} />
          <p className={s.note}>Data dari paket model <b>{data?.meta.modelRunId ?? "…"}</b>: titik sampel analisis 500 m, jendela lokal 3 km. Ini kemiripan medan berbasis data, bukan persetujuan lokasi misi.</p>
          <p className={s.srcnote}>Sumber: {data ? data.attribution.join(" · ") : "NASA PDS Geosciences Node · NASA LP DAAC"}</p>
        </aside>

        <main className={s.mapwrap}>
          {data && (
            <MapView
              windows={data.windows} cells={data.cells} body={body} activeWindowId={winId}
              selectedCellId={sel?.kind === "cell" ? sel.cell.id : null}
              layer={layer} opacity={opacity} panelOpen={!!sel}
              onReady={(a) => { api.current = a; setMapVersion((v) => v + 1); }}
              onSelectCell={(c: CellProps) => { setWinId(c.wid); setSel({ kind: "cell", cell: c }); }}
              onSelectWindow={(id) => openWindow(id)}
              onClearSelection={() => setSel(null)}
            />
          )}
          <div className={s.ctl}>
            <button aria-label="Perbesar" onClick={() => api.current?.zoomIn()}>+</button>
            <button aria-label="Perkecil" onClick={() => api.current?.zoomOut()}>−</button>
            <button onClick={reset}>Reset</button>
            <button onClick={overview}>Ikhtisar</button>
          </div>
          <div className={s.legend}>
            <b>{L.label} ({L.unit})</b>
            <div className={s.bar} style={{ background: `linear-gradient(90deg,${L.colors.join(",")})` }} />
            <div className={s.lr}><span>{fmt(L.range[0])}</span><span>{fmt(L.range[1])}</span></div>
            <div className={s.attr}>Titik sampel grid 500 m, digambar sebagai kotak 4 km. Skala tetap untuk semua jendela.</div>
          </div>
          {!data && !error && <div className={s.loading}>Memuat peta…</div>}
          {data && (
            <Inspector selection={sel} windows={data.windows} datasets={data.datasets} runId={data.meta.modelRunId} layer={layer}
              onClose={() => setSel(null)} onShowWindow={() => winId && setSel({ kind: "window", id: winId })} onZoom={() => winId && openWindow(winId)}
              expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
          )}
          {error && (
            <div className={s.err} role="alert">
              Gagal memuat data peta: {error}
              <button className={s.retry} onClick={() => setAttempt((n) => n + 1)}>Coba lagi</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
