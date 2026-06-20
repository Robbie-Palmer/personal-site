import { siteConfig } from "@/lib/config/site-config";

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`${siteConfig.name} — Projects & ADRs`}
        href="/projects/feed.xml"
      />
      {children}
    </>
  );
}
