import type { Metadata } from "next";
import { AgentApprovalView } from "@/components/recipes/settings/agent-approval-view";

export const metadata: Metadata = {
  title: "Approve agent access",
  description: "Review a delegated agent request for Robbie's Recipes.",
  robots: { index: false, follow: false },
};

export default function AgentApprovalPage() {
  return <AgentApprovalView />;
}
