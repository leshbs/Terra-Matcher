"use client";

import { useState } from "react";
import ContributionChart from "./contribution-chart";
import {
  type ComparisonCandidate,
  type FeatureDefinition,
  type FeatureKey,
} from "./contracts";
import WeightControlPanel from "./weight-control-panel";
import {
  cloneFeatureWeights,
  recomputeWithWeights,
  weightsAreEqual,
  type FeatureWeights,
} from "./weight-control";

type ComparisonExplainabilityProps = {
  candidate: ComparisonCandidate;
  featureDefinitions: Record<FeatureKey, FeatureDefinition>;
  modelWeights: FeatureWeights;
};

export default function ComparisonExplainability({
  candidate,
  featureDefinitions,
  modelWeights,
}: ComparisonExplainabilityProps) {
  const baseline = cloneFeatureWeights(modelWeights);
  const [weights, setWeights] = useState<FeatureWeights>(baseline);
  const recomputed = recomputeWithWeights(candidate.contributions, weights);
  const exploratory = !weightsAreEqual(weights, baseline);

  return (
    <div className="space-y-6">
      <WeightControlPanel
        weights={weights}
        baselineWeights={baseline}
        featureDefinitions={featureDefinitions}
        officialScore={candidate.similarityScore}
        exploratoryScore={recomputed.similarityScore}
        onChange={setWeights}
        onReset={() => setWeights(cloneFeatureWeights(baseline))}
      />

      <ContributionChart
        candidateName={candidate.name}
        contributions={recomputed.contributions}
        featureDefinitions={featureDefinitions}
        exploratory={exploratory}
        officialScore={candidate.similarityScore}
        exploratoryScore={recomputed.similarityScore}
      />
    </div>
  );
}
