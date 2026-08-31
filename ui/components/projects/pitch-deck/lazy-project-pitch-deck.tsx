"use client";

import dynamic from "next/dynamic";

const ProjectPitchDeck = dynamic(
  () =>
    import("./project-pitch-deck").then((module) => module.ProjectPitchDeck),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex aspect-video items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground"
        role="status"
      >
        Loading presentation...
      </div>
    ),
  },
);

export function LazyProjectPitchDeck({
  children,
  projectSlug,
  title,
}: Readonly<{
  children: React.ReactNode;
  projectSlug: string;
  title: string;
}>) {
  return (
    <>
      <ProjectPitchDeck projectSlug={projectSlug} title={title}>
        {children}
      </ProjectPitchDeck>
      <noscript>
        <p>
          <a href={`/projects/${projectSlug}/deck.md`}>
            Read the deck transcript
          </a>
        </p>
      </noscript>
    </>
  );
}
