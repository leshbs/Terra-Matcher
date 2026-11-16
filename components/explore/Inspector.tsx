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
  expanded: boolean;
  onToggleExpand: () => void;
}

export default function Inspector({ selection, windows, datasets, runId, layer, onClose, onShowWindow, onZoom, expanded, onToggleExpand }: Props) {
  if (!selection) {
    return <section className={`${s.insp} ${s.hint}`}>Select a sample cell or window marker to inspect terrain values.</section>;
  }
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
    <section className={`${s.insp} ${expanded ? s.expanded : ""}`} aria-live="polite">
      <button className={s.sheetToggle} onClick={onToggleExpand} aria-label={expanded ? "Collapse panel" : "Expand panel"}>{expanded ? "▾" : "▴"}</button>
      <button className={s.x} aria-label="Close" onClick={onClose}>×</button>
      {selection.kind === "cell" ? (
        <>
          <h3>Sample E{selection.cell.e} N{selection.cell.n} km</h3>
          <p className={s.sub}>{w.name}</p>
          <div className={s.grid}>{keys.map((k) => tile(k, selection.cell[k]))}</div>
          <p>Center: {selection.cell.lat}°, {selection.cell.lon}° (offset from window center)</p>
          <p>Dataset: {d.short} ({d.resolution})</p>
          <p>500 m analysis, 3 km local window · flag: <b>source-backed-derived</b></p>
          <button className={s.link} onClick={onShowWindow}>View window</button>
        </>
      ) : (
        <>
          <h3>{w.name}</h3>
          <p className={s.sub}>20 km radius · {w.points.length} sample points</p>
          <p>{w.rank ? <><b>Rank #{w.rank} of 5</b> · similarity score {fmt(w.score!)} · data coverage {Math.round((w.coverage ?? 0) * 100)}%</> : <b>Mars reference scenario</b>}</p>
          <p>{w.hypothesis}</p>
          <div className={s.grid}>{keys.map((k) => tile(k, w.features[k]))}</div>
          {w.contributions && (
            <>
              <b>Feature contributions</b>
              <p className={s.foot}>Weighted distance to Gale; lower values are more similar.</p>
              {w.contributions.map((c) => (
                <p key={c.featureKey}>
                  {FEATURE_LABELS[c.featureKey].label}: {fmt(c.candidateRaw)} vs {fmt(c.referenceRaw)} {FEATURE_LABELS[c.featureKey].unit} (Gale) · {c.weightedContribution.toFixed(3)}
                  <span className={s.bar2} style={{ width: `${Math.min(100, (c.weightedContribution / 0.35) * 100)}%` }} />
                </p>
              ))}
              <p className={s.foot}>Closest match: {FEATURE_LABELS[w.strongest!].label} · largest difference: {FEATURE_LABELS[w.mismatch!].label}</p>
            </>
          )}
          <b>Limitations</b>
          <ul>{[...w.limitations, ...d.limitations, ...EXTRA_LIMITATIONS].map((t) => <li key={t}>{t}</li>)}</ul>
          <details><summary>Citation and license</summary><p>{d.citation}</p><p>License: {d.license}</p></details>
          <button className={s.link} onClick={onZoom}>Zoom to window</button>
        </>
      )}
      <p className={s.foot}>Model run {runId} · source: {d.short}</p>
    </section>
  );
}
