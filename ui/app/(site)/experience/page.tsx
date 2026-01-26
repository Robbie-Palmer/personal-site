import { Briefcase, Layers } from "lucide-react";
import type { Metadata } from "next";
import { ExperienceCard } from "@/components/experience/experience-card";
import { SearchableTechnologyGrid } from "@/components/experience/searchable-technology-grid";
import { getAllExperience, getExperienceSlug } from "@/lib/api/experience";
import { siteConfig } from "@/lib/config/site-config";
import { loadDomainRepository } from "@/lib/domain";
import { getRoleProjects } from "@/lib/domain/project/projectQueries";
import {
  getAllTechnologyBadges,
  rankTechnologiesByConnections,
} from "@/lib/domain/technology";

const pageDescription =
  "Professional experience and career history of Robbie Palmer - Principal Software Engineer specializing in machine learning, computer vision, and data engineering.";

export const metadata: Metadata = {
  title: "Experience",
  description: pageDescription,
  openGraph: {
    title: "Experience - Robbie Palmer",
    description: pageDescription,
    url: `${siteConfig.url}/experience`,
  },
  twitter: {
    title: "Experience - Robbie Palmer",
    description: pageDescription,
  },
  alternates: {
    canonical: `${siteConfig.url}/experience`,
  },
};

export default function ExperiencePage() {
  const experiences = getAllExperience();
  const repository = loadDomainRepository();
  const technologyBadges = getAllTechnologyBadges(repository);

  // Rank technologies by knowledge graph connections
  const rankedTechnologies = rankTechnologiesByConnections(
    repository,
    technologyBadges,
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">Experience</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Professional experience and career history
      </p>

      <section className="mb-16">
        <h2 className="text-3xl font-semibold mb-8 flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-primary" />
          Roles
        </h2>
        <div className="relative">
          {/* Timeline line - from first circle to last circle */}
          <div
            className="absolute left-[19px] w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-primary/10 hidden md:block"
            style={{ top: "44px", height: "calc(100% - 88px)" }}
          />

          <div className="space-y-6">
            {experiences.map((experience) => {
              const roleSlug = getExperienceSlug(experience);
              const projects = getRoleProjects(repository, roleSlug);
              return (
                <ExperienceCard
                  key={`${experience.company}-${experience.startDate}`}
                  experience={experience}
                  id={roleSlug}
                  projects={projects}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section id="technologies" className="mb-16 scroll-mt-24">
        <h2 className="text-3xl font-semibold mb-8 flex items-center gap-2">
          <Layers className="w-7 h-7 text-primary" />
          Technologies
        </h2>
        <SearchableTechnologyGrid technologies={rankedTechnologies} />
      </section>
    </div>
  );
}
