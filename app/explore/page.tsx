import type { Metadata } from "next";
import ExploreShell from "@/components/explore/ExploreShell";

export const metadata: Metadata = { title: "Explore · Terra Analog Mission Control" };

export default function ExplorePage() {
  return <ExploreShell />;
}
