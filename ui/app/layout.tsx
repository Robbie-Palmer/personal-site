import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

// Use Cloudflare Pages URL for preview deployments, fallback to production URL
const baseUrl = process.env.CF_PAGES_URL || siteConfig.url;

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.linkedin }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    // Always use production URL for canonical/permanent reference, even in previews
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="antialiased flex flex-col min-h-screen">
            <header className="border-b">
              <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold hover:text-primary">
                  {siteConfig.name}
                </Link>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" asChild>
                    <Link href="/blog">Blog</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/experience">Experience</Link>
                  </Button>
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
