"use client";

import RevealNotes from "reveal.js/plugin/notes";
import { PitchDeckFrame } from "./pitch-deck-frame";

const notesPlugins = [RevealNotes()];

export function FocusedPitchDeck({
  children,
  projectSlug,
  title,
}: Readonly<{
  children: React.ReactNode;
  projectSlug: string;
  title: string;
}>) {
  return (
    <PitchDeckFrame
      projectSlug={projectSlug}
      title={title}
      mode="focused"
      plugins={notesPlugins}
    >
      {children}
    </PitchDeckFrame>
  );
}
