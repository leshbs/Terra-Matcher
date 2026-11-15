import Link from "next/link";
import {
  FEATURE_STATUS_STYLES,
  SCORE_BAND_LABELS,
  SCORE_BAND_STYLES,
  formatCoverage,
  formatScore,
  getFeatureStatus,
  getLargestMismatch,
  getScoreBand,
  getStrongestMatch,
  type ComparisonCandidate,
  type ComparisonScenario,
  type FeatureDefinition,
  type FeatureKey,
} from "./contracts";
import { MandatoryDisclaimer } from "./notices";

type RankingDashboardProps = {
  scenario: ComparisonScenario;
  candidates: ComparisonCandidate[];
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
  activeCandidateId?: string;
  compact?: boolean;
};

function featureLabel(
  key: FeatureKey,
  featureDefinitions: Record<FeatureKey, FeatureDefinition>,
): string {
  return featureDefinitions[key].shortLabel;
}

export default function RankingDashboard({
  scenario,
  candidates,
  featureDefinitions,
  activeCandidateId,
  compact = false,
}: RankingDashboardProps) {
  const ordered = [...candidates].sort(
    (left, right) => left.rank - right.rank,
  );

  return (
    <section
      aria-labelledby="ranking-heading"
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Similarity ranking
          </p>
          <h2
            id="ranking-heading"
            className="mt-1 text-2xl font-semibold tracking-tight text-white"
          >
            Earth candidates for {scenario.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Ranked by weighted terrain similarity. Every candidate is a
            hypothesis for review, not a claim of geological equivalence.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
          {ordered.length} candidates · 3 features
        </span>
      </div>

      <ol className="mt-5 space-y-3">
        {ordered.map((candidate) => {
          const band = getScoreBand(candidate.similarityScore);
          const bandStyle = SCORE_BAND_STYLES[band];
          const strongestMatch = getStrongestMatch(candidate);
          const largestMismatch = getLargestMismatch(candidate);
          const isActive = candidate.id === activeCandidateId;
          const strongestStatus = strongestMatch
            ? getFeatureStatus(strongestMatch)
            : "no-data";
          const mismatchStatus = largestMismatch
            ? getFeatureStatus(largestMismatch)
            : "no-data";

          return (
            <li key={candidate.id}>
              <Link
                href={`/compare/${scenario.id}/${candidate.id}`}
                prefetch
                aria-current={isActive ? "page" : undefined}
                className={`group grid gap-4 rounded-2xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:grid-cols-[auto_1fr_auto] sm:items-center ${
                  isActive
                    ? "border-cyan-300/70 bg-cyan-300/[0.07]"
                    : "border-slate-800 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3 sm:block">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-sm font-bold ${
                      candidate.rank === 1
                        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                    aria-label={`Rank ${candidate.rank}`}
                  >
                    {String(candidate.rank).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-slate-500 sm:hidden">
                    Rank
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-white">
                      {candidate.name}
                    </h3>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                      {candidate.country}
                    </span>
                    {candidate.profileStatus === "partial" && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                        Partial profile
                      </span>
                    )}
                  </div>

                  {!compact && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-400">
                      {candidate.summary}
                    </p>
                  )}

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Similarity</span>
                        <span className={`font-mono font-semibold ${bandStyle.text}`}>
                          {formatScore(candidate.similarityScore)}/100
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full rounded-full ${bandStyle.bar}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, candidate.similarityScore))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Data coverage</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {formatCoverage(candidate.dataCoverage)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"
                        role="progressbar"
                        aria-label={`Data coverage for ${candidate.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(
                          candidate.dataCoverage * 100,
                        )}
                      >
                        <div
                          className={`h-full rounded-full ${
                            candidate.profileStatus === "partial"
                              ? "bg-amber-300"
                              : "bg-slate-300"
                          }`}
                          style={{
                            width: `${candidate.dataCoverage * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {!compact && strongestMatch && largestMismatch && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="text-slate-500">
                        Strongest:{" "}
                        <span
                          className={
                            FEATURE_STATUS_STYLES[strongestStatus].text
                          }
                        >
                          {featureLabel(
                            strongestMatch.featureKey,
                            featureDefinitions,
                          )}
                        </span>
                      </span>
                      <span className="text-slate-500">
                        Largest gap:{" "}
                        <span
                          className={
                            FEATURE_STATUS_STYLES[mismatchStatus].text
                          }
                        >
                          {featureLabel(
                            largestMismatch.featureKey,
                            featureDefinitions,
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p
                      className={`font-mono text-3xl font-semibold leading-none tracking-tight ${bandStyle.text}`}
                    >
                      {formatScore(candidate.similarityScore)}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                      {SCORE_BAND_LABELS[band]}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors group-hover:border-cyan-300/50 group-hover:text-cyan-200"
                  >
                    →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <MandatoryDisclaimer />
        <p className="text-xs text-slate-500">
          Scores compare terrain features only. Gravity, atmosphere, and
          radiation are not modelled.
        </p>
      </div>
    </section>
  );
}
