import Link from "next/link";
import ContributionChart from "./contribution-chart";
import FeatureComparison from "./feature-comparison";
import RankingDashboard from "./ranking-dashboard";
import {
  SCORE_BAND_LABELS,
  SCORE_BAND_STYLES,
  formatCoordinate,
  formatCoverage,
  formatScore,
  getLargestMismatch,
  getScoreBand,
  getStrongestMatch,
  type ComparisonCandidate,
  type ComparisonFixture,
} from "./contracts";
import { FixtureNotice, MandatoryDisclaimer } from "./notices";

type ComparisonWorkspaceProps = {
  fixture: ComparisonFixture;
  candidate: ComparisonCandidate;
  candidates: ComparisonCandidate[];
};

function datasetIdsForComparison(fixture: ComparisonFixture, candidate: ComparisonCandidate) {
  return Array.from(
    new Set([
      ...fixture.scenario.sourceDatasetIds,
      ...candidate.sourceDatasetIds,
    ]),
  ).filter((datasetId) => datasetId !== "fixture-comparison-ui-v1");
}

export default function ComparisonWorkspace({
  fixture,
  candidate,
  candidates,
}: ComparisonWorkspaceProps) {
  const band = getScoreBand(candidate.similarityScore);
  const bandStyle = SCORE_BAND_STYLES[band];
  const strongestMatch = getStrongestMatch(candidate);
  const largestMismatch = getLargestMismatch(candidate);
  const datasetsById = Object.fromEntries(
    fixture.datasets.map((dataset) => [dataset.id, dataset]),
  );
  const evidenceDatasets = datasetIdsForComparison(fixture, candidate).map(
    (datasetId) => datasetsById[datasetId],
  );
  const selectedRank =
    candidates.findIndex((item) => item.id === candidate.id) + 1;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm text-slate-400"
      >
        <Link
          href="/compare"
          className="font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          Ranking dashboard
        </Link>
        <span aria-hidden="true">/</span>
        <span>Earth–Mars comparison</span>
        <span aria-hidden="true">/</span>
        <span className="text-slate-200">{candidate.name}</span>
      </nav>

      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-slate-950/50">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Earth–Mars comparison workspace
              </p>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                Candidate hypothesis
              </span>
              {candidate.profileStatus === "partial" && (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                  Partial profile
                </span>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {candidate.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {candidate.country} ·{" "}
              {formatCoordinate(
                candidate.center.latitude,
                "lat",
              )}{" "}
              ·{" "}
              {formatCoordinate(
                candidate.center.longitude,
                "lon",
              )}{" "}
              · {candidate.radiusKm} km window
            </p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              {candidate.summary}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Compared with{" "}
              <span className="font-medium text-slate-200">
                {fixture.scenario.name}
              </span>{" "}
              ({fixture.scenario.radiusKm} km reference window, centred at{" "}
              {formatCoordinate(fixture.scenario.center.latitude, "lat")},{" "}
              {formatCoordinate(fixture.scenario.center.longitude, "lon")}).
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
            <div
              role="img"
              aria-label={`Similarity score ${formatScore(candidate.similarityScore)} out of 100. ${SCORE_BAND_LABELS[band]}.`}
              className="relative h-32 w-32 rounded-full p-2"
              style={{
                background: `conic-gradient(${bandStyle.ring} ${Math.max(
                  0,
                  Math.min(100, candidate.similarityScore),
                )}%, #1e293b 0)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950">
                <span
                  className={`font-mono text-4xl font-semibold leading-none tracking-tight ${bandStyle.text}`}
                >
                  {formatScore(candidate.similarityScore)}
                </span>
                <span className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  / 100
                </span>
              </div>
            </div>
            <p className={`text-center text-sm font-semibold ${bandStyle.text}`}>
              {SCORE_BAND_LABELS[band]}
            </p>
            <div className="grid w-full grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Rank
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                  {candidate.rank}/{candidates.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Coverage
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-slate-100">
                  {formatCoverage(candidate.dataCoverage)}
                </p>
              </div>
            </div>
            <MandatoryDisclaimer className="w-full justify-center text-center" />
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-800 bg-slate-800 sm:grid-cols-3">
          <div className="bg-slate-900 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Strongest match
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-200">
              {strongestMatch
                ? fixture.featureDefinitions[strongestMatch.featureKey].label
                : "Not available"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {strongestMatch
                ? `${(strongestMatch.weightedContribution * 100).toFixed(2)} points removed`
                : "No comparable features"}
            </p>
          </div>
          <div className="bg-slate-900 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Largest mismatch
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-200">
              {largestMismatch
                ? fixture.featureDefinitions[largestMismatch.featureKey].label
                : "Not available"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {largestMismatch
                ? `${(largestMismatch.weightedContribution * 100).toFixed(2)} points removed`
                : "No comparable features"}
            </p>
          </div>
          <div className="bg-slate-900 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Operations hypothesis
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-300">
              {candidate.operationalHypothesis}
            </p>
          </div>
        </div>
      </header>

      <FixtureNotice model={fixture.model} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <FeatureComparison
            reference={fixture.scenario}
            candidate={candidate}
            featureDefinitions={fixture.featureDefinitions}
            datasetsById={datasetsById}
          />

          <ContributionChart
            candidateName={candidate.name}
            contributions={candidate.contributions}
            featureDefinitions={fixture.featureDefinitions}
          />
        </div>

        <aside className="space-y-6">
          <section
            aria-labelledby="match-mismatch-heading"
            className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Interpretation
            </p>
            <h2
              id="match-mismatch-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-white"
            >
              Match and mismatch
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              A strong score is not a complete analogy. The differences below
              are part of the result, not footnotes.
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-xs"
                  >
                    +
                  </span>
                  Match points
                </h3>
                {candidate.matchPoints.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-5 text-emerald-50/80">
                    {candidate.matchPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-emerald-50/70">
                    No features meet the configured match threshold. This
                    candidate is kept as a clear mismatch case.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-400/15 text-xs"
                  >
                    −
                  </span>
                  Mismatch points
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-5 text-rose-50/80">
                  {candidate.mismatchPoints.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="limitations-heading"
            className="rounded-3xl border border-amber-400/25 bg-amber-400/[0.05] p-5 shadow-2xl shadow-slate-950/40"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Scientific boundaries
            </p>
            <h2
              id="limitations-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-white"
            >
              Limitations
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50/80">
              {candidate.limitations.map((limitation) => (
                <li key={limitation} className="flex gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-amber-400/20 pt-4">
              <h3 className="text-sm font-semibold text-amber-100">
                Unmodelled conditions
              </h3>
              <p className="mt-2 text-xs leading-5 text-amber-100/70">
                Gravity, atmospheric pressure and composition, radiation,
                thermal regime, dust, and biological activity are outside this
                terrain-only comparison.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Next action
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Review the evidence trail
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This comparison is a shareable report. Send the URL to a
              reviewer, then inspect the source datasets and model run below.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/compare"
                className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/50 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                View full ranking
              </Link>
              <Link
                href={`/compare/${fixture.scenario.id}/${
                  candidates[(selectedRank % candidates.length) % candidates.length]
                    ?.id ?? candidate.id
                }`}
                prefetch
                className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-300/50 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Next candidate
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <section
        aria-labelledby="provenance-heading"
        className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/40 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Provenance
            </p>
            <h2
              id="provenance-heading"
              className="mt-1 text-2xl font-semibold tracking-tight text-white"
            >
              Model run and source evidence
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Source links identify the intended DEM products for the final
              model run. This fixture is synthetic; replace it with validated
              pipeline output before presenting scientific conclusions.
            </p>
          </div>
          <code className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            {fixture.model.modelRunId}
          </code>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Model version
            </dt>
            <dd className="mt-1 font-mono text-slate-200">
              {fixture.model.modelVersion}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Transform
            </dt>
            <dd className="mt-1 font-mono text-slate-200">
              {fixture.model.transformationVersion}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Generated at
            </dt>
            <dd className="mt-1 font-mono text-slate-200">
              {fixture.model.generatedAt}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Feature weights
            </dt>
            <dd className="mt-1 font-mono text-slate-200">
              {Object.values(fixture.featureDefinitions)
                .map((definition) => `${Math.round(definition.weight * 100)}%`)
                .join(" / ")}
            </dd>
          </div>
        </dl>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {evidenceDatasets.map((dataset) => (
            <article
              key={dataset.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    {dataset.product}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {dataset.provider} · {dataset.version}
                  </p>
                </div>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  {dataset.role}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                {dataset.citation}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {dataset.nativeResolution} · {dataset.unit}
              </p>
              <a
                href={dataset.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                Open dataset page →
              </a>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Global limitations
          </h3>
          <ul className="mt-2 grid gap-2 text-xs leading-5 text-slate-400 lg:grid-cols-2">
            {fixture.globalLimitations.map((limitation) => (
              <li key={limitation} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 border-t border-slate-800 pt-4">
          <MandatoryDisclaimer />
        </div>
      </section>

      <RankingDashboard
        scenario={fixture.scenario}
        candidates={candidates}
        featureDefinitions={fixture.featureDefinitions}
        activeCandidateId={candidate.id}
      />
    </div>
  );
}
