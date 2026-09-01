import type { Metadata } from "next";
import { Suspense } from "react";
import {
  type InitiativePrototype,
  ProjectPrototypes,
  type PrototypeProject,
} from "@/components/projects/project-prototypes";
import { getAllProjects } from "@/lib/api/projects";
import { getAllInitiatives, loadDomainRepository } from "@/lib/domain";

export const metadata: Metadata = {
  title: "Project page explorations",
  description:
    "Four ways to navigate initiatives, projects, decisions, and technologies.",
  robots: { index: false, follow: false },
};

const prototypeInitiatives = [
  {
    slug: "personalized-medicine",
    title: "Personalized medicine",
    shortGoal: "Turn pathology and genomic data into better treatment choices.",
    question: "How can patient-specific decisions become faster and cheaper?",
    projectSlugs: [
      "ai-assisted-macrodissection",
      "automated-macrodissection",
      "genomic-prediction",
      "pathology-viewer",
      "bioinformatics-platform",
    ],
    tone: "rose",
    isPublished: true,
    references: ["Digital pathology", "Multi-omic analysis"],
  },
  {
    slug: "trustworthy-intelligent-systems",
    title: "Trustworthy intelligent systems",
    shortGoal:
      "Make machine-assisted decisions observable, reviewable, and safe to change.",
    question: "What makes an intelligent system worthy of operational trust?",
    projectSlugs: [
      "agentic-code-review",
      "pii-detection",
      "confluent-python-udfs",
      "customer-health-forecasting",
    ],
    tone: "blue",
    isPublished: false,
    references: ["AI evaluation", "Human oversight", "Data governance"],
  },
  {
    slug: "context-aware-products",
    title: "Products that understand context",
    shortGoal:
      "Help software reason over messy personal and commercial information.",
    question: "How can a product use context without making people manage it?",
    projectSlugs: [
      "commercial-knowledge-graph",
      "multi-modal-product-search",
      "chatbot",
    ],
    tone: "amber",
    isPublished: false,
    references: ["Knowledge graphs", "Retrieval", "Multimodal search"],
  },
  {
    slug: "personal-software",
    title: "Personal software with a long memory",
    shortGoal:
      "Build tools that learn from a household without taking control away.",
    question: "What should personal software remember, and who should own it?",
    projectSlugs: [
      "recipe-site",
      "personal-finance-app",
      "personal-site",
      "homelab",
    ],
    tone: "green",
    isPublished: false,
    references: ["Local-first software", "Personal data", "Calm technology"],
  },
] as const;

function toPrototypeProject(
  project: ReturnType<typeof getAllProjects>[number],
): PrototypeProject {
  return {
    slug: project.slug,
    title: project.title,
    description: project.description,
    date: project.date,
    status: project.status,
    role: project.role?.company,
    tags: project.tags,
    technologies: project.technologies.slice(0, 5).map((technology) => ({
      slug: technology.slug,
      name: technology.name,
    })),
    decisions: project.adrs.slice(0, 4).map((adr) => ({
      slug: adr.slug,
      title: adr.title.replace(/^ADR\s+\d+:\s*/i, ""),
      status: adr.status,
    })),
    decisionCount: project.adrs.length,
  };
}

export default function ProjectPrototypesPage() {
  const projectsBySlug = new Map(
    getAllProjects().map((project) => [
      project.slug,
      toPrototypeProject(project),
    ]),
  );
  const repository = loadDomainRepository();
  const publishedInitiatives = new Map(
    getAllInitiatives(repository).map((initiative) => [
      initiative.slug,
      initiative,
    ]),
  );

  const initiatives: InitiativePrototype[] = prototypeInitiatives.map(
    (initiative) => ({
      ...initiative,
      description:
        publishedInitiatives.get(initiative.slug)?.description ??
        initiative.shortGoal,
      projects: initiative.projectSlugs
        .map((slug) => projectsBySlug.get(slug))
        .filter(
          (project): project is PrototypeProject => project !== undefined,
        ),
    }),
  );

  return (
    <Suspense>
      <ProjectPrototypes initiatives={initiatives} />
    </Suspense>
  );
}
