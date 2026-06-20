import { siteConfig } from "@/lib/config/site-config";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Preconnect to Cloudflare Images for faster image loading */}
      <link
        rel="preconnect"
        href="https://imagedelivery.net"
        crossOrigin="anonymous"
      />
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`${siteConfig.name} — ${siteConfig.blog.title}`}
        href="/blog/feed.xml"
      />
      {children}
    </>
  );
}
