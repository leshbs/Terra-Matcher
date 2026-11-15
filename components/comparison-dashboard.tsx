"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";

const dataModeSchema = z.enum(["fixture", "production"]);

const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.string().min(1),
  description: z.string().nullable(),
});

const scenariosResponseSchema = z.object({
  scenarios: z.array(scenarioSchema.extend({ dataMode: dataModeSchema })),
});

const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  source: z.string().min(1),
  features: z.object({
    medianSlopeDeg: z.number().min(0).max(90),
    terrainRoughnessM: z.number().min(0),
    relativeReliefM: z.number().min(0),
  }),
  similarityScore: z.number().min(0).max(100),
  generatedAt: z.iso.datetime({ offset: true }),
  rank: z.number().int().positive().optional(),
  dataCoverage: z.number().min(0).max(1).optional(),
  sourceDatasetIds: z.array(z.string().min(1)).length(2).optional(),
  contributions: z.array(z.object({
    featureKey: z.enum(["median_slope_deg", "terrain_roughness_m", "relative_relief_m"]),
    available: z.literal(true),
    normalizedWeight: z.number().positive(),
    weightedContribution: z.number().min(0),
  })).length(3).optional(),
  evidence: z.object({
    operationalHypothesis: z.string().min(1),
    limitations: z.array(z.string().min(1)).min(1),
    sourceDatasetIds: z.array(z.string().min(1)).length(2),
  }).optional(),
}).refine(
  (candidate) =>
    (candidate.latitude === null) === (candidate.longitude === null),
  { message: "Incomplete coordinates." },
);

const candidatesResponseSchema = z.object({
  scenario: scenarioSchema,
  dataMode: dataModeSchema,
  modelRunId: z.string().min(1),
  modelVersion: z.string().min(1),
  limitations: z.array(z.string().min(1)).min(1),
  candidates: z.array(candidateSchema),
});

type Scenario = z.infer<typeof scenariosResponseSchema>["scenarios"][number];
type CandidateResponse = z.infer<typeof candidatesResponseSchema>;

type LoadState =
  | { status: "loading"; key: string }
  | { status: "error"; key: string }
  | { status: "empty"; key: string }
  | {
      status: "ready";
      key: string;
      scenarios: Scenario[];
      result: CandidateResponse;
    };

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("API request failed.");
  }
  return response.json();
}

export default function ComparisonDashboard() {
  const [scenarioId, setScenarioId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([scenarioId, retry]);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    key: requestKey,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const list = scenariosResponseSchema.parse(
          await fetchJson("/api/scenarios", controller.signal),
        );

        if (controller.signal.aborted) return;

        if (list.scenarios.length === 0) {
          setState({ status: "empty", key: requestKey });
          return;
        }

        const scenario = scenarioId
          ? list.scenarios.find((item) => item.id === scenarioId)
          : list.scenarios[0];

        if (!scenario) throw new Error("Scenario is unavailable.");

        const result = candidatesResponseSchema.parse(
          await fetchJson(
            `/api/scenarios/${encodeURIComponent(scenario.id)}/candidates`,
            controller.signal,
          ),
        );

        if (
          result.scenario.id !== scenario.id ||
          result.dataMode !== scenario.dataMode
        ) {
          throw new Error("Scenario metadata mismatch.");
        }

        if (controller.signal.aborted) return;

        setState({
          status: "ready",
          key: requestKey,
          scenarios: list.scenarios,
          result,
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", key: requestKey });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [scenarioId, retry, requestKey]);

  const current: LoadState =
    state.key === requestKey
      ? state
      : { status: "loading", key: requestKey };

  const selectedCandidate =
    current.status === "ready"
      ? current.result.candidates.find((item) => item.id === candidateId) ??
        current.result.candidates[0]
      : undefined;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
            Earth–Mars terrain comparison
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Terra Analog Mission Control
          </h1>
          <p className="max-w-3xl text-slate-300">
            Explore terrain similarity between Earth candidates and a Mars
            reference scenario. Scores are not probabilities or landing-site
            recommendations.
          </p>
          <Link
            href="/methodology"
            className="inline-flex rounded-lg border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            Methodology &amp; provenance
          </Link>
        </header>

        {current.status === "loading" && (
          <section
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-slate-700 bg-slate-900 p-6"
          >
            Loading scenarios and candidate scores…
          </section>
        )}

        {current.status === "error" && (
          <section
            role="alert"
            className="space-y-4 rounded-2xl border border-red-800 bg-slate-900 p-6"
          >
            <h2 className="text-xl font-semibold">Comparison unavailable</h2>
            <p className="text-slate-300">
              The API request failed or its response could not be validated.
              No local fixture fallback has been substituted.
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              Try again
            </button>
          </section>
        )}

        {current.status === "empty" && (
          <section role="status" className="rounded-2xl border border-slate-700 p-6">
            No scenarios are currently available.
          </section>
        )}

        {current.status === "ready" && (
          <>
            <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <label htmlFor="scenario" className="block font-semibold">
                Reference scenario
              </label>
              <select
                id="scenario"
                value={current.result.scenario.id}
                onChange={(event) => {
                  setScenarioId(event.target.value);
                  setCandidateId("");
                }}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                {current.scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-slate-300">
                Reference body: {current.result.scenario.body}
              </p>
              {current.result.scenario.description && (
                <p className="text-slate-300">{current.result.scenario.description}</p>
              )}
              <div className="rounded-lg border border-amber-700 bg-amber-950 p-4 text-amber-100">
                <p className="font-bold">
                  {current.result.dataMode === "fixture"
                    ? "FIXTURE — SYNTHETIC DEMO DATA"
                    : "PRODUCTION DATA"}
                </p>
                <p className="mt-1 text-sm">
                  {current.result.dataMode === "fixture"
                    ? "Terrain values and scores are illustrative, not measurements or scientifically validated analog assessments."
                    : "Review the sources and model limitations before interpreting these scores."}
                </p>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h2 className="text-xl font-semibold">Candidate ranking</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {current.result.dataMode === "production"
                    ? "Similarity scale: 0–100. It expresses only terrain-feature similarity, not a probability or approval."
                    : "Similarity scale: 0–1, not a probability. Select a candidate to inspect its terrain features."}
                </p>
                {current.result.candidates.length === 0 ? (
                  <p className="mt-6" role="status">No candidates are available.</p>
                ) : (
                  <ol className="mt-6 space-y-3">
                    {current.result.candidates.map((candidate, index) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          aria-pressed={selectedCandidate?.id === candidate.id}
                          onClick={() => setCandidateId(candidate.id)}
                          className={`flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                            selectedCandidate?.id === candidate.id
                              ? "border-cyan-300 bg-slate-800"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          <span>
                            <span className="block font-semibold">
                              {candidate.rank ?? index + 1}. {candidate.name}
                            </span>
                            <span className="text-sm text-slate-400">
                              {candidate.country ?? "Country not supplied"}
                            </span>
                          </span>
                          <span className="font-mono text-xl text-cyan-300">
                            {candidate.similarityScore.toFixed(2)}
                            {current.result.dataMode === "production" ? " / 100" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <h2 className="text-xl font-semibold">Candidate detail</h2>
                {selectedCandidate ? (
                  <div className="mt-6 space-y-6">
                    <h3 className="text-2xl font-semibold">{selectedCandidate.name}</h3>
                    <dl className="space-y-4">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-300">Median slope</dt>
                        <dd>{selectedCandidate.features.medianSlopeDeg.toFixed(2)}°</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-300">Terrain roughness</dt>
                        <dd>{selectedCandidate.features.terrainRoughnessM.toFixed(2)} m</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-300">Relative relief</dt>
                        <dd>{selectedCandidate.features.relativeReliefM.toFixed(2)} m</dd>
                      </div>
                    </dl>
                    <div className="border-t border-slate-700 pt-4 text-sm text-slate-300">
                      <p className="font-semibold text-slate-100">Source</p>
                      <p className="mt-1 break-words">{selectedCandidate.source}</p>
                      <p className="mt-4">
                        Coordinates:{" "}
                        {selectedCandidate.latitude === null
                          ? "Not supplied — no map marker."
                          : `${selectedCandidate.latitude}, ${selectedCandidate.longitude}`}
                      </p>
                      <p className="mt-2 break-words">
                        Generated at (UTC): {selectedCandidate.generatedAt}
                      </p>
                    </div>
                    {selectedCandidate.evidence && selectedCandidate.contributions && (
                      <section className="space-y-4 rounded-xl border border-cyan-900 bg-slate-950 p-4 text-sm">
                        <h4 className="font-semibold text-cyan-100">Evidence &amp; caveats</h4>
                        <p className="text-slate-300">
                          <span className="font-medium text-slate-100">Operational hypothesis: </span>
                          {selectedCandidate.evidence.operationalHypothesis}
                        </p>
                        {selectedCandidate.dataCoverage !== undefined && (
                          <p className="text-slate-300">
                            <span className="font-medium text-slate-100">Data coverage: </span>
                            {(selectedCandidate.dataCoverage * 100).toFixed(0)}%
                          </p>
                        )}
                        <div>
                          <p className="font-medium text-slate-100">Feature contributions</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                            {selectedCandidate.contributions.map((contribution) => (
                              <li key={contribution.featureKey}>
                                {contribution.featureKey.replaceAll("_", " ")}: weight {contribution.normalizedWeight.toFixed(2)}, contribution {contribution.weightedContribution.toFixed(4)}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">Candidate limitations</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                            {selectedCandidate.evidence.limitations.map((limitation) => (
                              <li key={limitation}>{limitation}</li>
                            ))}
                          </ul>
                        </div>
                        <p className="break-words text-slate-400">
                          Source dataset IDs: {selectedCandidate.evidence.sourceDatasetIds.join(", ")}
                        </p>
                      </section>
                    )}
                  </div>
                ) : (
                  <p className="mt-6 text-slate-300">No candidate detail to display.</p>
                )}
              </section>
            </div>

            <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Model & limitations</h2>
              <dl className="space-y-2 break-words text-sm">
                <div>
                  <dt className="inline text-slate-400">Run: </dt>
                  <dd className="inline font-mono">{current.result.modelRunId}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-400">Version: </dt>
                  <dd className="inline font-mono">{current.result.modelVersion}</dd>
                </div>
              </dl>
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {current.result.limitations.map((limitation, index) => (
                  <li key={`${index}-${limitation}`}>{limitation}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        <footer className="text-sm text-slate-400">
          MVP: terrain-feature comparison only. No gravity, atmosphere, or
          radiation model. No landing-site recommendation.
        </footer>
      </div>
    </main>
  );
}
