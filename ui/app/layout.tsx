import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
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
    <html lang="en">
      <body className="antialiased">
        <header className="border-b">
          <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold hover:text-primary">
              Robbie Palmer
            </Link>
            <div className="flex gap-6">
              <Button variant="ghost" asChild>
                <Link href="/blog">Blog</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/experience">Experience</Link>
              </Button>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
