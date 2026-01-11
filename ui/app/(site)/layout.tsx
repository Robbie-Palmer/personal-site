import { Footer } from "@/components/footer";
import { ScrollNavbar } from "@/components/scroll-navbar";
import { NavbarActionsProvider } from "@/context/navbar-actions-context";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NavbarActionsProvider>
      <div className="antialiased flex flex-col min-h-screen">
        <ScrollNavbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </div>
    </NavbarActionsProvider>
  );
}
