import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PitchDeckPresenter } from "@/components/projects/pitch-deck/pitch-deck-presenter";
import {
  getAllProjects,
  getProject,
  type ProjectWithADRs,
} from "@/lib/api/projects";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllProjects()
    .filter((project) => project.pitch)
    .map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = getProject(slug);
    if (!project.pitch) return { title: "Presenter not found" };
    return {
      title: `${project.pitch.title} presenter`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Presenter not found" };
  }
}

export default async function ProjectDeckPresenterPage({
  params,
}: Readonly<PageProps>) {
  const { slug } = await params;
  let project: ProjectWithADRs;

  try {
    project = getProject(slug);
  } catch {
    notFound();
  }

  if (!project.pitch) notFound();

  return (
    <PitchDeckPresenter
      deckHref={`/projects/${project.slug}/deck`}
      title={project.pitch.title}
    />
  );
}
