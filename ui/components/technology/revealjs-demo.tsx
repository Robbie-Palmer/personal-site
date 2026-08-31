"use client";

import { PitchDeckFrame } from "@/components/projects/pitch-deck/pitch-deck-frame";

export function RevealJsDemo({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PitchDeckFrame
      title="reveal.js integration demo"
      mode="embedded"
      showPresenterTools
      showSpeakerView={false}
      presentationHref="/technologies/revealdotjs/deck"
    >
      {children}
    </PitchDeckFrame>
  );
}
