"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

const methodologySchema = z.object({
  modelRun: z.object({
    id: z.string().min(1),
    analysisResolutionM: z.number().positive(),
    localWindowKm: z.number().positive(),
    transformationVersion: z.string().min(1),
    inputDatasetIds: z.array(z.string().min(1)).length(2),
  }),
  datasets: z.array(z.object({
    id: z.string().min(1),
    provider: z.string().min(1),
    product: z.string().min(1),
    version: z.string().min(1),
    url: z.string().url(),
    accessUrl: z.string().url(),
    nativeResolution: z.record(z.string(), z.unknown()),
    unit: z.string().min(1),
    citation: z.string().min(1),
    limitations: z.array(z.string().min(1)).min(1),
  })).length(2),
  features: z.array(z.object({
    key: z.string().min(1),
    name: z.string().min(1),
    unit: z.string().min(1),
    localWindowKm: z.number().positive(),
  })).length(3),
  limitations: z.array(z.string().min(1)).min(1),
});

type Methodology = z.infer<typeof methodologySchema>;

export default function MethodologyContent() {
  const [methodology, setMethodology] = useState<Methodology>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/methodology", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Methodology request failed.");
        return response.json();
      })
      .then((payload) => {
        if (!controller.signal.aborted) setMethodology(methodologySchema.parse(payload));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 font-sans text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Methodology &amp; provenance</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">From Mars data to Earth-tested questions</h1>
          <p className="max-w-3xl text-slate-300">
            This MVP compares three terrain features across a shared analysis scale. It generates candidate hypotheses for study, not mission-site recommendations.
          </p>
          <Link href="/" className="inline-flex rounded-lg border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
            Back to mission control
          </Link>
        </header>

        {error && (
          <section role="alert" className="rounded-2xl border border-red-800 bg-slate-900 p-6">
            Methodology data is temporarily unavailable. No unverified substitute is shown.
          </section>
        )}

        {!error && !methodology && (
          <section role="status" className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
            Loading registered datasets and model run…
          </section>
        )}

        {methodology && (
          <>
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Analysis configuration</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-400">Model run</dt><dd className="mt-1 font-mono break-words">{methodology.modelRun.id}</dd></div>
                <div><dt className="text-slate-400">Transform</dt><dd className="mt-1 font-mono break-words">{methodology.modelRun.transformationVersion}</dd></div>
                <div><dt className="text-slate-400">Analysis resolution</dt><dd className="mt-1">{methodology.modelRun.analysisResolutionM} m</dd></div>
                <div><dt className="text-slate-400">Local window</dt><dd className="mt-1">{methodology.modelRun.localWindowKm} km</dd></div>
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">What the score uses</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {methodology.features.map((feature) => (
                  <li key={feature.key} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <p className="font-semibold">{feature.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{feature.unit}; {feature.localWindowKm} km local window</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">Registered source datasets</h2>
              {methodology.datasets.map((dataset) => (
                <article key={dataset.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <h3 className="font-semibold">{dataset.product} {dataset.version}</h3>
                  <p className="mt-1 text-sm text-slate-300">{dataset.provider} · {dataset.unit}</p>
                  <p className="mt-3 text-sm text-slate-300">{dataset.citation}</p>
                  <p className="mt-3 break-words text-sm"><a className="text-cyan-300 underline hover:text-cyan-200" href={dataset.accessUrl} target="_blank" rel="noreferrer">Open documented dataset access</a></p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
                    {dataset.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                  </ul>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-amber-700 bg-amber-950 p-6 text-amber-100">
              <h2 className="text-xl font-semibold">Scientific boundary</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
                {methodology.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
