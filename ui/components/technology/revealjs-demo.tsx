"use client";

import RevealNotes from "reveal.js/plugin/notes";
import { PitchDeckFrame } from "@/components/projects/pitch-deck/pitch-deck-frame";

const notesPlugins = [RevealNotes()];

export function RevealJsDemo({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PitchDeckFrame
      title="reveal.js integration demo"
      mode="embedded"
      plugins={notesPlugins}
      showPresenterTools
    >
      {children}
    </PitchDeckFrame>
  );
}
