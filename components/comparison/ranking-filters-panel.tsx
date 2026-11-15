"use client";

import { useId, type ReactNode } from "react";
import {
  FEATURE_KEYS,
  PARTIAL_DISTANCE_THRESHOLD,
  type FeatureDefinition,
  type FeatureKey,
} from "./contracts";
import {
  COVERAGE_FILTER_OPTIONS,
  hasActiveRankingFilters,
  type PriorityFeature,
  type RankingFilters,
} from "./ranking-filters";

type RankingFiltersPanelProps = {
  filters: RankingFilters;
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
  totalCount: number;
  visibleCount: number;
  onChange: (filters: RankingFilters) => void;
  onReset: () => void;
};

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
        active
          ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100"
          : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function RankingFiltersPanel({
  filters,
  featureDefinitions,
  totalCount,
  visibleCount,
  onChange,
  onReset,
}: RankingFiltersPanelProps) {
  const id = useId();
  const minScoreId = `${id}-min-score`;
  const maxScoreId = `${id}-max-score`;
  const coverageId = `${id}-coverage`;
  const active = hasActiveRankingFilters(filters);

  const priorityOptions: { value: PriorityFeature; label: string }[] = [
    { value: "none", label: "Any feature" },
    ...FEATURE_KEYS.map((key) => ({
      value: key,
      label: featureDefinitions[key].shortLabel,
    })),
  ];

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id={`${id}-heading`}
            className="text-sm font-semibold text-slate-100"
          >
            Refine ranking
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Filters change the visible list, not the underlying pipeline score
            or rank.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!active}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.8fr_1.5fr]">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-300">
            Similarity score range
          </legend>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <label
                htmlFor={minScoreId}
                className="w-8 shrink-0 text-[11px] text-slate-500"
              >
                Min
              </label>
              <input
                id={minScoreId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={filters.minScore}
                onChange={(event) => {
                  const minScore = Number(event.target.value);
                  onChange({
                    ...filters,
                    minScore,
                    maxScore: Math.max(minScore, filters.maxScore),
                  });
                }}
                className="h-1.5 w-full cursor-pointer accent-cyan-300"
              />
              <output
                htmlFor={minScoreId}
                className="w-9 shrink-0 text-right font-mono text-xs text-slate-200"
              >
                {filters.minScore}
              </output>
            </div>
            <div className="flex items-center gap-3">
              <label
                htmlFor={maxScoreId}
                className="w-8 shrink-0 text-[11px] text-slate-500"
              >
                Max
              </label>
              <input
                id={maxScoreId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={filters.maxScore}
                onChange={(event) => {
                  const maxScore = Number(event.target.value);
                  onChange({
                    ...filters,
                    maxScore,
                    minScore: Math.min(maxScore, filters.minScore),
                  });
                }}
                className="h-1.5 w-full cursor-pointer accent-cyan-300"
              />
              <output
                htmlFor={maxScoreId}
                className="w-9 shrink-0 text-right font-mono text-xs text-slate-200"
              >
                {filters.maxScore}
              </output>
            </div>
          </div>
        </fieldset>

        <div>
          <label
            htmlFor={coverageId}
            className="block text-xs font-semibold text-slate-300"
          >
            Minimum data coverage
          </label>
          <select
            id={coverageId}
            value={filters.minCoverage}
            onChange={(event) => {
              onChange({
                ...filters,
                minCoverage: Number(event.target.value),
              });
            }}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            {COVERAGE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Partial profiles are excluded when their coverage falls below this
            threshold.
          </p>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-slate-300">
            Priority feature
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {priorityOptions.map((option) => (
              <FilterChip
                key={option.value}
                active={filters.priorityFeature === option.value}
                onClick={() =>
                  onChange({
                    ...filters,
                    priorityFeature: option.value,
                  })
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Keeps candidates within{" "}
            <span className="font-mono text-slate-400">
              {PARTIAL_DISTANCE_THRESHOLD.toFixed(2)}
            </span>{" "}
            normalized distance on the selected feature.
          </p>
        </fieldset>
      </div>

      <p
        aria-live="polite"
        className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400"
      >
        Showing{" "}
        <span className="font-mono font-semibold text-slate-100">
          {visibleCount}
        </span>{" "}
        of <span className="font-mono">{totalCount}</span> candidates
        {active ? " with the current filters." : "."}
      </p>
    </section>
  );
}
