import { Footer } from "@/components/footer";
import { NotFoundLinks } from "@/components/not-found-links";
import { ScrollNavbar } from "@/components/scroll-navbar";
import { NavbarActionsProvider } from "@/contexts/navbar-actions-context";

const sections = [
  {
    title: "Home",
    description: "ML expert, full-stack builder, and team lead who ships",
    href: "/",
  },
  {
    title: "Blog",
    description:
      "Writing about machine learning, software engineering, and building products",
    href: "/blog",
  },
  {
    title: "Projects",
    description: "Technical projects with architecture decision records",
    href: "/projects",
  },
  {
    title: "Experience",
    description: "Professional roles and career timeline",
    href: "/experience",
  },
  {
    title: "Asset Tracker",
    description: "Track and manage your assets",
    href: "/assettracker",
  },
];

export default function NotFound() {
  return (
    <NavbarActionsProvider>
      <div className="antialiased flex flex-col min-h-screen">
        <ScrollNavbar />
        <main className="flex-1 flex flex-col">
          <div className="container mx-auto px-4 py-12 text-center flex flex-col items-center justify-center flex-1">
            <h1 className="text-6xl font-bold text-primary">404</h1>
            <p className="mt-4 text-2xl font-medium text-foreground">
              Page Not Found
            </p>
            <p className="mt-2 text-muted-foreground">
              Sorry, the page you are looking for does not exist.
              <br />
              Were you looking for one of these?
            </p>

            <div className="mt-12 w-full max-w-4xl">
              <NotFoundLinks sections={sections} />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </NavbarActionsProvider>
  );
}
