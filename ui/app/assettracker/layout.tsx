import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Asset Tracker",
    template: "%s | Asset Tracker",
  },
  description: "Track and manage your assets",
};

export default function AssetTrackerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Asset Tracker Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold">Asset Tracker</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/assettracker" className="hover:underline">
                Home
              </a>
              <a href="/assettracker/about" className="hover:underline">
                About
              </a>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>

      {/* Asset Tracker Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Asset Tracker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
