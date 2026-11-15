import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComparisonWorkspace from "@/components/comparison/comparison-workspace";
import {
  comparisonFixture,
  getComparisonView,
} from "@/components/comparison/data";

// Every valid scenario/candidate pair is prerendered via generateStaticParams,
// so params resolve without a network round-trip and no loading fallback is
// needed. Opting out of instant-shell validation keeps navigation to those
// prerendered pages immediate instead of streaming a Suspense placeholder.
export const instant = false;

type ComparisonPageProps = {
  params: Promise<{
    scenarioId: string;
    candidateId: string;
  }>;
};

export function generateStaticParams() {
  return comparisonFixture.candidates.map((candidate) => ({
    scenarioId: comparisonFixture.scenario.id,
    candidateId: candidate.id,
  }));
}

export async function generateMetadata({
  params,
}: ComparisonPageProps): Promise<Metadata> {
  const { scenarioId, candidateId } = await params;
  const view = getComparisonView(scenarioId, candidateId);

  if (!view) {
    return {
      title: "Comparison not found — Terra Analog Mission Control",
    };
  }

  return {
    title: `${view.candidate.name} vs ${view.scenario.name} — Terra Analog Mission Control`,
    description: `Earth–Mars terrain comparison for ${view.candidate.name}. Data-derived similarity, not mission-site approval.`,
  };
}

export default async function ComparisonPage({
  params,
}: ComparisonPageProps) {
  const { scenarioId, candidateId } = await params;
  const view = getComparisonView(scenarioId, candidateId);

  if (!view) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 font-sans text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ComparisonWorkspace
          fixture={comparisonFixture}
          candidate={view.candidate}
          candidates={view.candidates}
        />
      </div>
    </main>
  );
}
