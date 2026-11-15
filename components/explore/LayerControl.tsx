"use client";

import { LAYERS } from "@/lib/explore/layers";
import type { LayerKey } from "@/lib/explore/types";
import s from "./styles";

interface Props { value: LayerKey; onChange: (k: LayerKey) => void; opacity: number; onOpacity: (v: number) => void }

export default function LayerControl({ value, onChange, opacity, onOpacity }: Props) {
  return (
    <section aria-label="Terrain layers">
      <h2 className={s.h2}>Layer medan</h2>
      <div role="radiogroup" aria-label="Terrain layer">
        {(Object.keys(LAYERS) as LayerKey[]).map((k) => (
          <button key={k} role="radio" aria-checked={value === k} className={`${s.item} ${value === k ? s.on : ""}`} onClick={() => onChange(k)}>
            <b>{LAYERS[k].label} ({LAYERS[k].unit})</b>
            <small>{LAYERS[k].description}</small>
          </button>
        ))}
      </div>
      <label className={s.op}>Opasitas
        <input type="range" min={30} max={100} value={Math.round(opacity * 100)} onChange={(e) => onOpacity(+e.target.value / 100)} />
      </label>
    </section>
  );
}
