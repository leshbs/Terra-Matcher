import type {
  ComparisonDataset,
  ComparisonDataSourceInfo,
} from "./contracts";

export const MANDATORY_DISCLAIMER =
  "data-derived similarity, not mission-site approval";

export function MandatoryDisclaimer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p
      className={`inline-flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100 ${className}`}
    >
      <span aria-hidden="true" className="mt-0.5 text-amber-300">
        !
      </span>
      <span>{MANDATORY_DISCLAIMER}</span>
    </p>
  );
}

export function DataSourceBadge({
  source,
}: {
  source: ComparisonDataSourceInfo;
}) {
  return (
    <span
      title={source.description}
      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          source.isFixture ? "bg-amber-300" : "bg-emerald-300"
        }`}
      />
      {source.label}
    </span>
  );
}

export function FixtureNotice({
  model,
  source,
  compact = false,
}: {
  model: ComparisonDataset["model"];
  source?: ComparisonDataSourceInfo;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
        <span className="rounded bg-amber-300 px-1.5 py-0.5 font-bold text-slate-950">
          FIXTURE
        </span>
        Synthetic demo values, not measurements.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-amber-300 px-2 py-1 text-xs font-bold tracking-wide text-slate-950">
          SYNTHETIC FIXTURE
        </span>
        <p className="font-semibold">
          Day 1 UI data — illustrative values, not measurements.
        </p>
      </div>
      <p className="mt-3 max-w-4xl text-amber-100/80">
        {model.provenanceNote} Replace this fixture with the validated model
        run before presenting scientific results.
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-amber-100/70">
        <div>
          <dt className="inline">Run: </dt>
          <dd className="inline">{model.modelRunId}</dd>
        </div>
        <div>
          <dt className="inline">Version: </dt>
          <dd className="inline">{model.modelVersion}</dd>
        </div>
        {source && (
          <div>
            <dt className="inline">Source: </dt>
            <dd className="inline">{source.label}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ProductionNotice({
  dataset,
  source,
}: {
  dataset: ComparisonDataset;
  source?: ComparisonDataSourceInfo;
}) {
  return (
    <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4 text-sm text-emerald-50 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-bold tracking-wide text-slate-950">
          BACKEND RUN
        </span>
        <p className="font-semibold">
          Features and scores come from the configured backend run.
        </p>
      </div>
      <p className="mt-3 max-w-4xl text-emerald-50/75">
        {dataset.model.provenanceNote}
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-emerald-50/65">
        <div>
          <dt className="inline">Run: </dt>
          <dd className="inline">{dataset.model.modelRunId}</dd>
        </div>
        <div>
          <dt className="inline">Version: </dt>
          <dd className="inline">{dataset.model.modelVersion}</dd>
        </div>
        {source && (
          <div>
            <dt className="inline">Source: </dt>
            <dd className="inline">{source.label}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 border-t border-emerald-400/20 pt-3 text-xs leading-5 text-emerald-50/70">
        Review the model manifest, source products, and limitations before
        interpretation. This dataset has not been independently approved as a
        mission-site recommendation.
      </p>
    </section>
  );
}

export function DataModeNotice({
  dataset,
  source,
  compact = false,
}: {
  dataset: ComparisonDataset;
  source?: ComparisonDataSourceInfo;
  compact?: boolean;
}) {
  if (dataset.dataMode === "fixture") {
    return (
      <FixtureNotice model={dataset.model} source={source} compact={compact} />
    );
  }

  return <ProductionNotice dataset={dataset} source={source} />;
}

export function SourceWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <section
      aria-labelledby="source-warnings-heading"
      className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100"
    >
      <h2
        id="source-warnings-heading"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300"
      >
        Source warnings
      </h2>
      <ul className="mt-2 space-y-1.5">
        {warnings.map((warning) => (
          <li key={warning} className="flex gap-2 text-amber-50/80">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
            <span>{warning}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
