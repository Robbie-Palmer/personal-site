"use client";

import "reveal.js/reveal.css";
import "@/components/projects/pitch-deck/pitch-deck.css";
import RevealNotes from "reveal.js/plugin/notes";
import { PitchDeckFrame } from "@/components/projects/pitch-deck/pitch-deck-frame";

const notesPlugins = [RevealNotes()];

export function FocusedRevealJsDemo({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PitchDeckFrame
      title="reveal.js integration demo"
      mode="focused"
      plugins={notesPlugins}
      backHref="/technologies/revealdotjs"
      backLabel="Back to technology"
    >
      {children}
    </PitchDeckFrame>
  );
}
