"use client";

import { EXTRA_LIMITATIONS, FEATURE_LABELS, LAYERS, fmt } from "@/lib/explore/layers";
import type { DatasetInfo, LayerKey, Selection, WindowData } from "@/lib/explore/types";
import s from "./styles";

interface Props {
  selection: Selection;
  windows: WindowData[];
  datasets: Record<string, DatasetInfo>;
  runId: string;
  layer: LayerKey;
  onClose: () => void;
  onShowWindow: () => void;
  onZoom: () => void;
}

export default function Inspector({ selection, windows, datasets, runId, layer, onClose, onShowWindow, onZoom }: Props) {
  if (!selection) return null;
  const w = windows.find((x) => x.id === (selection.kind === "window" ? selection.id : selection.cell.wid));
  if (!w) return null;
  const d = datasets[w.datasetId];
  const tile = (k: LayerKey, v: number) => (
    <div key={k} className={`${s.m} ${layer === k ? s.on : ""}`}>
      <span>{LAYERS[k].label}</span><b>{fmt(v)}</b> {LAYERS[k].unit}
    </div>
  );
  const keys = Object.keys(LAYERS) as LayerKey[];

  return (
    <section className={s.insp} aria-live="polite">
      <button className={s.x} aria-label="Tutup" onClick={onClose}>×</button>
      {selection.kind === "cell" ? (
        <>
          <h3>Titik E{selection.cell.e} N{selection.cell.n} km</h3>
          <p className={s.sub}>{w.name}</p>
          <div className={s.grid}>{keys.map((k) => tile(k, selection.cell[k]))}</div>
          <p>Pusat: {selection.cell.lat}°, {selection.cell.lon}° (offset dari pusat jendela)</p>
          <p>Dataset: {d.short} ({d.resolution})</p>
          <p>Analisis 500 m, jendela lokal 3 km · flag: <b>source-backed-derived</b></p>
          <button className={s.link} onClick={onShowWindow}>Lihat jendela</button>
        </>
      ) : (
        <>
          <h3>{w.name}</h3>
          <p className={s.sub}>Radius 20 km · {w.points.length} titik sampel</p>
          <p>{w.rank ? <><b>Peringkat #{w.rank} dari 5</b> · skor kemiripan {fmt(w.score!)} · cakupan data {Math.round((w.coverage ?? 0) * 100)}%</> : <b>Skenario acuan Mars</b>}</p>
          <p>{w.hypothesis}</p>
          <div className={s.grid}>{keys.map((k) => tile(k, w.features[k]))}</div>
          {w.contributions && (
            <>
              <b>Kontribusi per fitur</b>
              <p className={s.foot}>Jarak berbobot ke Gale; makin kecil makin mirip.</p>
              {w.contributions.map((c) => (
                <p key={c.featureKey}>
                  {FEATURE_LABELS[c.featureKey].label}: {fmt(c.candidateRaw)} vs {fmt(c.referenceRaw)} {FEATURE_LABELS[c.featureKey].unit} (Gale) · {c.weightedContribution.toFixed(3)}
                  <span className={s.bar2} style={{ width: `${Math.min(100, (c.weightedContribution / 0.35) * 100)}%` }} />
                </p>
              ))}
              <p className={s.foot}>Paling cocok: {FEATURE_LABELS[w.strongest!].label} · paling berbeda: {FEATURE_LABELS[w.mismatch!].label}</p>
            </>
          )}
          <b>Keterbatasan</b>
          <ul>{[...w.limitations, ...d.limitations, ...EXTRA_LIMITATIONS].map((t) => <li key={t}>{t}</li>)}</ul>
          <details><summary>Sitasi dan lisensi</summary><p>{d.citation}</p><p>Lisensi: {d.license}</p></details>
          <button className={s.link} onClick={onZoom}>Zoom ke jendela</button>
        </>
      )}
      <p className={s.foot}>Model run {runId} · sumber: {d.short}</p>
    </section>
  );
}
