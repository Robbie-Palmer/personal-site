"use client";

import { PitchDeckFrame } from "./pitch-deck-frame";

export function ProjectPitchDeck({
  children,
  projectSlug,
  title,
}: Readonly<{
  children: React.ReactNode;
  projectSlug: string;
  title: string;
}>) {
  return (
    <PitchDeckFrame projectSlug={projectSlug} title={title} mode="embedded">
      {children}
    </PitchDeckFrame>
  );
}
