import type { Metadata } from "next";
import { DiscoverFeed } from "@/components/recipes/discover-feed";

export const metadata: Metadata = {
  title: "Discover",
  description: "See the newest recipes shared by home cooks.",
};

export default function DiscoverPage() {
  return <DiscoverFeed />;
}
