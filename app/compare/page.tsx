import type { Metadata } from "next";
import Link from "next/link";
import RankingDashboard from "@/components/comparison/ranking-dashboard";
import {
  getComparisonBundle,
  getRankedCandidatesFromDataset,
} from "@/components/comparison/data";
import {
  FEATURE_KEYS,
  formatCoordinate,
  type FeatureKey,
} from "@/components/comparison/contracts";
import {
  DataModeNotice,
  DataSourceBadge,
  MandatoryDisclaimer,
  SourceWarnings,
} from "@/components/comparison/notices";

export const metadata: Metadata = {
  title: "Similarity ranking — Terra Analog Mission Control",
  description:
    "Ranked Earth candidate hypotheses for the Gale Crater reference window. Data-derived terrain similarity, not mission-site approval.",
};

export default async function CompareIndexPage() {
  const bundle = await getComparisonBundle({ scenarioId: "mars-gale-aeolis-palus-v1" });
  const { dataset, source, warnings } = bundle;
  const candidates = getRankedCandidatesFromDataset(
    dataset,
    dataset.scenario.id,
  );

  if (!candidates) {
    throw new Error("Comparison dataset scenario is unavailable.");
  }

  const datasetById = Object.fromEntries(
    dataset.datasets.map((record) => [record.id, record]),
  );
  const referenceDataset =
    datasetById[dataset.scenario.features.median_slope_deg.sourceDatasetId];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 font-sans text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-sm text-slate-400"
        >
          <Link
  href="/"
  className="font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
>
  Back to main dashboard
</Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-200">Ranking dashboard</span>
        </nav>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Comparison &amp; ranking · Day 2
            </p>
            <DataSourceBadge source={source} />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Earth candidate ranking
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
                Five curated Earth windows are compared with one Mars
                reference window using three terrain features. The ranking is
                explainable, source-aware, and explicitly bounded.
              </p>
            </div>
            <Link
              href={`/compare/${dataset.scenario.id}/${candidates[0].id}`}
              prefetch
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              Open top comparison →
            </Link>
          </div>
          <MandatoryDisclaimer />
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-200">
                Mars reference
              </span>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400">
                {dataset.scenario.radiusKm} km window
              </span>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400">
                {referenceDataset?.provider ?? "Source pending"}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {dataset.scenario.name}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {dataset.scenario.summary}
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              {formatCoordinate(dataset.scenario.center.latitude, "lat")} ·{" "}
              {formatCoordinate(dataset.scenario.center.longitude, "lon")} · MOLA reference ·{" "}
              {dataset.scenario.features.median_slope_deg.analysisResolutionM} m source resolution
            
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                Candidates
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-slate-100">
                {candidates.length}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                Features
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold text-slate-100">
                {FEATURE_KEYS.length}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                Method
              </dt>
              <dd className="mt-1 text-xs font-semibold text-slate-200">
                Weighted L1
              </dd>
            </div>
          </dl>
        </section>

        <DataModeNotice dataset={dataset} source={source} />
        <SourceWarnings warnings={warnings} />

        <RankingDashboard
          scenario={dataset.scenario}
          candidates={candidates}
          featureDefinitions={dataset.featureDefinitions}
          showFilters
        />

        <section
          aria-labelledby="method-heading"
          className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6 lg:grid-cols-[1.2fr_1fr]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Method
            </p>
            <h2
              id="method-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-white"
            >
              How the score is built
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Each feature is converted to a percentile within its own body
              population. The score is the weighted L1 distance from the Mars
              reference percentile vector:
            </p>
            <code className="mt-3 block overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs leading-6 text-cyan-100">
              100 × (1 − Σ weightᵢ × |candidateᵢ − referenceᵢ|)
            </code>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Data coverage is the share of configured weight with comparable
              values on both sides. Missing features are excluded and the
              remaining weights are renormalised; partial profiles are marked
              and must not be compared directly with complete profiles.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {FEATURE_KEYS.map((key: FeatureKey) => {
              const definition = dataset.featureDefinitions[key];

              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200">
                      {definition.label}
                    </p>
                    <span className="font-mono text-sm text-cyan-200">
                      {Math.round(definition.weight * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {definition.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5 text-sm text-slate-500">
          <p>
            Terrain-feature comparison only. Not a landing-site recommendation.
          </p>
          <p className="font-mono text-xs">
            {dataset.model.modelRunId} · {dataset.model.modelVersion}
          </p>
        </footer>
      </div>
    </main>
  );
}
