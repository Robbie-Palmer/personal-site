import "reveal.js/reveal.css";
import "@/components/projects/pitch-deck/pitch-deck.css";
import { siteConfig } from "@/lib/config/site-config";

export default function ProjectsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
