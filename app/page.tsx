import RankingSummary from "@/components/mission-control/RankingSummary";
import { getComparisonBundle } from "@/components/comparison/data";

export const instant = false;

export default async function Home() {
  const { dataset } = await getComparisonBundle({ scenarioId: "mars-gale-aeolis-palus-v1" });
  return <RankingSummary dataset={dataset} />;
}
