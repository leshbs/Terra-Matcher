"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FEATURE_KEYS,
  FEATURE_STATUS_LABELS,
  FEATURE_STATUS_STYLES,
  formatNormalizedValue,
  getFeatureStatus,
  getScoreImpact,
  type FeatureContribution,
  type FeatureDefinition,
  type FeatureKey,
  type FeatureStatus,
} from "./contracts";

type ContributionChartProps = {
  candidateName: string;
  contributions: FeatureContribution[];
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
};

type ChartDatum = {
  key: FeatureKey;
  name: string;
  fullName: string;
  scoreImpact: number;
  weight: number;
  normalizedWeight: number;
  distance: number | null;
  status: FeatureStatus;
  color: string;
  note: string;
};

const STATUS_COLORS: Record<FeatureStatus, string> = {
  match: "#6ee7b7",
  partial: "#fcd34d",
  mismatch: "#fb7185",
  "no-data": "#64748b",
};

export default function ContributionChart({
  candidateName,
  contributions,
  featureDefinitions,
}: ContributionChartProps) {
  const data: ChartDatum[] = FEATURE_KEYS.map((key) => {
    const contribution = contributions.find(
      (item) => item.featureKey === key,
    );

    if (!contribution) {
      throw new Error(`Missing contribution for feature: ${key}`);
    }

    const status = getFeatureStatus(contribution);

    return {
      key,
      name: featureDefinitions[key].shortLabel,
      fullName: featureDefinitions[key].label,
      scoreImpact: Number(getScoreImpact(contribution).toFixed(2)),
      weight: contribution.weight,
      normalizedWeight: contribution.normalizedWeight,
      distance: contribution.featureDistance,
      status,
      color: STATUS_COLORS[status],
      note: contribution.note,
    };
  });

  const chartMaximum = Math.max(
    5,
    Math.ceil(Math.max(...data.map((datum) => datum.scoreImpact)) / 5) * 5,
  );
  const partialProfile = data.some((datum) => datum.status === "no-data");

  return (
    <section
      aria-labelledby="contribution-heading"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Explainability
          </p>
          <h2
            id="contribution-heading"
            className="mt-1 text-2xl font-semibold tracking-tight text-white"
          >
            Score contribution by feature
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Each bar shows how many points a feature removes from a perfect
            score of 100. A shorter bar means a closer match.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
          Weighted L1 distance
        </span>
      </div>

      <div
        className="mt-5 h-72 w-full"
        role="img"
        aria-label={`Contribution chart for ${candidateName}. ${data
          .map(
            (datum) =>
              `${datum.fullName}: ${
                datum.status === "no-data"
                  ? "no data"
                  : `${datum.scoreImpact.toFixed(2)} points removed`
              }`,
          )
          .join(". ")}.`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 640, height: 288 }}
        >
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              stroke="#1e293b"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#334155" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, chartMaximum]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={42}
              label={{
                value: "points",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              wrapperStyle={{ outline: "none" }}
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as
                  | ChartDatum
                  | undefined;

                if (!active || !datum) return null;

                return (
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs shadow-2xl shadow-slate-950/60">
                    <p className="font-semibold text-slate-100">
                      {datum.fullName}
                    </p>
                    <p className="mt-1 text-slate-400">
                      {FEATURE_STATUS_LABELS[datum.status]} ·{" "}
                      {datum.status === "no-data"
                        ? "excluded"
                        : `${datum.scoreImpact.toFixed(2)} points removed`}
                    </p>
                    <p className="mt-1 text-slate-500">
                      Weight {datum.weight.toFixed(2)} · Normalized{" "}
                      {datum.normalizedWeight.toFixed(2)} · Distance{" "}
                      {formatNormalizedValue(datum.distance)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="scoreImpact"
              name="Score impact (points)"
              radius={[0, 6, 6, 0]}
              isAnimationActive={false}
            >
              {data.map((datum) => (
                <Cell key={datum.key} fill={datum.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {data.map((datum) => (
          <li
            key={datum.key}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${FEATURE_STATUS_STYLES[datum.status].dot}`}
                />
                {datum.fullName}
              </span>
              <span
                className={`font-mono text-sm ${FEATURE_STATUS_STYLES[datum.status].text}`}
              >
                {datum.status === "no-data"
                  ? "Excluded"
                  : `${datum.scoreImpact.toFixed(2)} pts`}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {datum.note}
            </p>
          </li>
        ))}
      </ul>

      {partialProfile && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          Partial profile: missing features are excluded and the remaining
          weights are renormalised. Do not compare this score directly with a
          complete profile.
        </p>
      )}
    </section>
  );
}
