import { TechMobileNav } from "@/components/technology/tech-mobile-nav";
import { TechStickySidebar } from "@/components/technology/tech-sticky-sidebar";
import { loadDomainRepository } from "@/lib/domain";
import { getAllTechnologyBadgesSorted } from "@/lib/domain/technology";

interface TechnologyLayoutProps {
  children: React.ReactNode;
}

export default function TechnologyLayout({ children }: TechnologyLayoutProps) {
  const repository = loadDomainRepository();
  const technologies = getAllTechnologyBadgesSorted(repository);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="lg:grid lg:grid-cols-[280px_1fr] list-none gap-8 items-start">
        {/* Mobile Navigation Trigger - Renders via Portal */}
        <TechMobileNav technologies={technologies} />

        {/* Desktop Sidebar */}
        <TechStickySidebar technologies={technologies} />

        {/* Main Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
