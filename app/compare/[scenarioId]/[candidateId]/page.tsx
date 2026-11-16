import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ComparisonWorkspace from "@/components/comparison/comparison-workspace";
import {
  getComparisonBundle,
  getComparisonViewFromDataset,
} from "@/components/comparison/data";

export const instant = false;

type ComparisonPageProps = {
  params: Promise<{
    scenarioId: string;
    candidateId: string;
  }>;
};

export async function generateMetadata({
  params,
}: ComparisonPageProps): Promise<Metadata> {
  const { scenarioId, candidateId } = await params;
  const { dataset } = await getComparisonBundle({ scenarioId });
  const view = getComparisonViewFromDataset(dataset, scenarioId, candidateId);

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
  const bundle = await getComparisonBundle({ scenarioId });
  const view = getComparisonViewFromDataset(
    bundle.dataset,
    scenarioId,
    candidateId,
  );

  if (!view) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 font-sans text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ComparisonWorkspace
          dataset={bundle.dataset}
          source={bundle.source}
          warnings={bundle.warnings}
          candidate={view.candidate}
          candidates={view.candidates}
        />
      </div>
    </main>
  );
}
