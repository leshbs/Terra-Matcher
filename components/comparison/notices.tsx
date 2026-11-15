import type { ComparisonFixture } from "./contracts";

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

export function FixtureNotice({
  model,
  compact = false,
}: {
  model: ComparisonFixture["model"];
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
      </dl>
    </section>
  );
}
