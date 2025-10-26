import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Robbie Palmer",
  description: "Personal website and blog",
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
                  Robbie Palmer
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
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
