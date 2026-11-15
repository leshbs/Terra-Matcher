"use client";

import { useId } from "react";
import {
  FEATURE_KEYS,
  formatScore,
  type FeatureDefinition,
  type FeatureKey,
} from "./contracts";
import {
  cloneFeatureWeights,
  normalizeFeatureWeights,
  sumFeatureWeights,
  weightsAreEqual,
  type FeatureWeights,
} from "./weight-control";

type WeightControlPanelProps = {
  weights: FeatureWeights;
  baselineWeights: FeatureWeights;
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
  officialScore: number;
  exploratoryScore: number;
  onChange: (weights: FeatureWeights) => void;
  onReset: () => void;
};

export default function WeightControlPanel({
  weights,
  baselineWeights,
  featureDefinitions,
  officialScore,
  exploratoryScore,
  onChange,
  onReset,
}: WeightControlPanelProps) {
  const id = useId();
  const dirty = !weightsAreEqual(weights, baselineWeights);
  const rawTotal = sumFeatureWeights(weights);
  const preview = normalizeFeatureWeights(weights);
  const scoreDelta = exploratoryScore - officialScore;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Sensitivity check
          </p>
          <h2
            id={`${id}-heading`}
            className="mt-1 text-2xl font-semibold tracking-tight text-white"
          >
            Feature weight control
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Adjust relative importance for an exploratory re-score. This does
            not change the published model-run ranking or provenance.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent"
        >
          Reset to model weights
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {FEATURE_KEYS.map((key) => {
          const inputId = `${id}-${key}`;
          const definition = featureDefinitions[key];
          const percent = Math.round(preview[key] * 100);

          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor={inputId}
                  className="text-sm font-medium text-slate-200"
                >
                  {definition.label}
                </label>
                <output
                  htmlFor={inputId}
                  className="font-mono text-sm text-cyan-200"
                >
                  {percent}%
                </output>
              </div>
              <input
                id={inputId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(weights[key] * 100)}
                onChange={(event) => {
                  const next = cloneFeatureWeights(weights);
                  next[key] = Number(event.target.value) / 100;
                  onChange(next);
                }}
                className="mt-2 h-1.5 w-full cursor-pointer accent-cyan-300"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Model baseline {Math.round(baselineWeights[key] * 100)}% · unit{" "}
                {definition.unit}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Official score
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-slate-100">
            {formatScore(officialScore)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Exploratory score
          </p>
          <p className="mt-1 font-mono text-xl font-semibold text-cyan-200">
            {formatScore(exploratoryScore)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Delta
          </p>
          <p
            className={`mt-1 font-mono text-xl font-semibold ${
              Math.abs(scoreDelta) < 0.05
                ? "text-slate-300"
                : scoreDelta > 0
                  ? "text-emerald-200"
                  : "text-rose-200"
            }`}
          >
            {scoreDelta > 0 ? "+" : ""}
            {scoreDelta.toFixed(1)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Slider values are renormalised to 100% before scoring
        {Math.abs(rawTotal - 1) > 0.000001
          ? ` (current raw total ${Math.round(rawTotal * 100)}%).`
          : "."}{" "}
        Published ranks stay fixed to the model run weights.
      </p>
    </section>
  );
}
