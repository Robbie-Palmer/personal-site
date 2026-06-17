import { notFound } from "next/navigation";
import { ADRMobileNav } from "@/components/projects/adr-mobile-nav";
import { ADRStickySidebar } from "@/components/projects/adr-sticky-sidebar";
import { getProject, type ProjectWithADRs } from "@/lib/api/projects";
import { siteConfig } from "@/lib/config/site-config";

interface ADRLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function ADRLayout({ children, params }: ADRLayoutProps) {
  const { slug } = await params;
  let project: ProjectWithADRs;
  try {
    project = getProject(slug);
  } catch (_e) {
    notFound();
  }
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`${siteConfig.name} — Architecture Decision Records`}
        href="/adrs/feed.xml"
      />

      <div className="lg:grid lg:grid-cols-[280px_1fr] list-none gap-8 items-start">
        {/* Mobile Navigation Trigger - Renders via Portal */}
        <ADRMobileNav project={project} />

        {/* Desktop Sidebar */}
        <ADRStickySidebar project={project} />

        {/* Main Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
