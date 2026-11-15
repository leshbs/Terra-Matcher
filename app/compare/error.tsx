"use client";

export default function CompareError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-slate-950 p-8 text-slate-100"><section className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-slate-900 p-6"><h1 className="text-xl font-semibold">Comparison unavailable</h1><p className="mt-2 text-slate-300">The production ranking could not be loaded. No demo fixture has been substituted.</p><button type="button" onClick={reset} className="mt-4 rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950">Try again</button></section></main>;
}
