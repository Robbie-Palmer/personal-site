import { describe, expect, it } from "vitest";
import { REVEALJS_DEMO_SOURCE } from "@/components/technology/revealjs-demo-source";
import { pitchDeckToAgentMarkdown } from "@/lib/domain/project/pitchDeck";

describe("reveal.js technology demo", () => {
  it("keeps the integrated feature fixtures in one six-slide deck", () => {
    expect(REVEALJS_DEMO_SOURCE.split("\n---\n")).toHaveLength(6);
    expect(REVEALJS_DEMO_SOURCE).toContain("<Mermaid");
    expect(REVEALJS_DEMO_SOURCE).toContain("~~~ts {2-4}");
    expect(REVEALJS_DEMO_SOURCE).toContain("<ReviewDepthDemo />");
    expect(REVEALJS_DEMO_SOURCE.match(/<PitchStep/g)).toHaveLength(3);
    expect(REVEALJS_DEMO_SOURCE).toContain("<PitchNotes>");
  });

  it("still produces a public transcript without speaker notes", () => {
    const transcript = pitchDeckToAgentMarkdown(REVEALJS_DEMO_SOURCE);

    expect(transcript.match(/^## Slide /gm)).toHaveLength(6);
    expect(transcript).not.toContain("Speaker notes stay attached");
    expect(transcript).not.toContain("PitchNotes");
  });
});
