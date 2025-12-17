import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import { ExperienceCard } from "@/components/experience/experience-card";
import { getAllExperience } from "@/lib/experience";
import { siteConfig } from "@/lib/site-config";

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
            {experiences.map((experience) => (
              <ExperienceCard
                key={`${experience.company}-${experience.startDate}`}
                experience={experience}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
