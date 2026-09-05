import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FocusedPitchDeck } from "@/components/projects/pitch-deck/focused-pitch-deck";
import { PitchDeckContent } from "@/components/projects/pitch-deck/pitch-deck-content";
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
    if (!project.pitch) return { title: "Pitch deck not found" };
    return {
      title: project.pitch.title,
      description: project.pitch.description,
    };
  } catch {
    return { title: "Pitch deck not found" };
  }
}

export default async function ProjectDeckPage({ params }: Readonly<PageProps>) {
  const { slug } = await params;
  let project: ProjectWithADRs;

  try {
    project = getProject(slug);
  } catch {
    notFound();
  }

  if (!project.pitch) notFound();

  return (
    <main>
      <FocusedPitchDeck projectSlug={project.slug} title={project.pitch.title}>
        <PitchDeckContent source={project.pitch.content} />
      </FocusedPitchDeck>
    </main>
  );
}
