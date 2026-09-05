import type { Metadata } from "next";
import { InitiativesIndexRedirect } from "@/components/initiatives/initiatives-index-redirect";

export const metadata: Metadata = {
  title: "Initiatives",
  description:
    "Long-running outcomes that connect several projects and explain why they belong together.",
  alternates: { canonical: "/projects?tab=initiatives" },
  robots: { follow: true, index: false },
};

export default function InitiativesPage() {
  return <InitiativesIndexRedirect />;
}
