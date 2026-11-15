import {
  FEATURE_KEYS,
  FEATURE_STATUS_LABELS,
  FEATURE_STATUS_STYLES,
  formatNormalizedValue,
  formatRawValue,
  getFeatureStatus,
  getScoreImpact,
  type ComparisonCandidate,
  type ComparisonScenario,
  type DatasetRecord,
  type FeatureDefinition,
  type FeatureKey,
} from "./contracts";

type FeatureComparisonProps = {
  reference: ComparisonScenario;
  candidate: ComparisonCandidate;
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
  datasetsById: Record<string, DatasetRecord>;
  dataMode?: "fixture" | "production";
};

function datasetShortLabel(
  datasetId: string,
  datasetsById: Record<string, DatasetRecord>,
): string {
  if (datasetId.includes("mola")) return "MOLA";
  if (datasetId.includes("nasadem")) return "NASADEM";
  return datasetsById[datasetId]?.provider ?? "Fixture source";
}

function NormalizedBar({
  value,
  tone,
}: {
  value: number | null;
  tone: string;
}) {
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
      aria-hidden="true"
    >
      <div
        className={`h-full rounded-full ${tone}`}
        style={{
          width: `${value === null ? 0 : Math.max(2, value * 100)}%`,
        }}
      />
    </div>
  );
}

export default function FeatureComparison({
  reference,
  candidate,
  featureDefinitions,
  datasetsById,
  dataMode = "fixture",
}: FeatureComparisonProps) {
  const valueProvenance =
    dataMode === "fixture" ? "fixture value" : "model-run value";

  return (
    <section
      aria-labelledby="feature-comparison-heading"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Earth vs Mars
          </p>
          <h2
            id="feature-comparison-heading"
            className="mt-1 text-2xl font-semibold tracking-tight text-white"
          >
            Feature-by-feature comparison
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Each feature shows raw value, unit, and normalised percentile.
            Percentiles are computed separately per body, so a raw Earth metre
            is never treated as physically equivalent to a raw Mars metre.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
          3 km analysis window
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {FEATURE_KEYS.map((key) => {
          const definition = featureDefinitions[key];
          const contribution = candidate.contributions.find(
            (item) => item.featureKey === key,
          );

          if (!contribution) {
            throw new Error(`Missing contribution for feature: ${key}`);
          }

          const status = getFeatureStatus(contribution);
          const statusStyle = FEATURE_STATUS_STYLES[status];
          const referenceFeature = reference.features[key];
          const candidateFeature = candidate.features[key];
          const impact = getScoreImpact(contribution);

          return (
            <article
              key={key}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {definition.label}
                    </h3>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                      Weight {Math.round(definition.weight * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {definition.description} Analysis window:{" "}
                    {definition.analysisWindow}.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle.badge}`}
                >
                  {FEATURE_STATUS_LABELS[status]}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-red-400/15 bg-red-400/[0.04] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
                    Mars reference
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {reference.name}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-2xl font-semibold text-slate-100">
                        {formatRawValue(
                          referenceFeature.rawValue,
                          definition.unitSymbol,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Raw · {definition.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold text-slate-200">
                        {formatNormalizedValue(
                          referenceFeature.normalizedValue,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Normalised
                      </p>
                    </div>
                  </div>
                  <NormalizedBar
                    value={referenceFeature.normalizedValue}
                    tone="bg-red-300/70"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Intended source:{" "}
                    {datasetShortLabel(
                      referenceFeature.sourceDatasetId,
                      datasetsById,
                    )}{" "}
                    · {referenceFeature.analysisResolutionM} m resolution ·{" "}
                    {valueProvenance}
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                    Earth candidate
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {candidate.name}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-2xl font-semibold text-slate-100">
                        {formatRawValue(
                          candidateFeature.rawValue,
                          definition.unitSymbol,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Raw · {definition.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-lg font-semibold text-slate-200">
                        {formatNormalizedValue(
                          candidateFeature.normalizedValue,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                        Normalised
                      </p>
                    </div>
                  </div>
                  <NormalizedBar
                    value={candidateFeature.normalizedValue}
                    tone="bg-cyan-300"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Intended source:{" "}
                    {datasetShortLabel(
                      candidateFeature.sourceDatasetId,
                      datasetsById,
                    )}{" "}
                    · {candidateFeature.analysisResolutionM} m resolution ·{" "}
                    {valueProvenance}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-slate-500">
                    Normalized distance:{" "}
                    <span className={`font-mono ${statusStyle.text}`}>
                      {contribution.featureDistance === null
                        ? "Not available"
                        : contribution.featureDistance.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    Score impact:{" "}
                    <span className={`font-mono ${statusStyle.text}`}>
                      {status === "no-data"
                        ? "Excluded"
                        : `${impact.toFixed(2)} pts`}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    Normalized weight:{" "}
                    <span className="font-mono text-slate-300">
                      {contribution.normalizedWeight.toFixed(2)}
                    </span>
                  </span>
                </div>
                {status === "no-data" && (
                  <span className="text-amber-200">
                    Remaining weights renormalised
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm leading-5 text-slate-400">
                {contribution.note}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
