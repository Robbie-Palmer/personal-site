import type { Root } from "mdast";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vitest";
import {
  countPitchSlides,
  pitchDeckToAgentMarkdown,
  remarkPitchSlides,
} from "@/lib/domain/project/pitchDeck";

describe("pitch deck content", () => {
  it("groups only root thematic breaks into slides", () => {
    const source = `# One

\`\`\`md
---
\`\`\`

<PitchColumns>
  <div>---</div>
</PitchColumns>

---

## Two`;
    const processor = remark().use(remarkMdx).use(remarkPitchSlides);
    const tree = processor.runSync(processor.parse(source)) as Root;

    expect(tree.children).toHaveLength(2);
    expect(
      tree.children.every((node) => node.type === "mdxJsxFlowElement"),
    ).toBe(true);
    expect(tree.children[0]).toMatchObject({ name: "PitchSlide" });
  });

  it("builds a numbered transcript without speaker notes", () => {
    const source = `# One

<PitchNotes>private-note-sentinel</PitchNotes>

---

## Two

## Slide details

<PitchColumns><PitchColumn>Readable child</PitchColumn></PitchColumns>`;

    const result = pitchDeckToAgentMarkdown(source);

    expect(result).toContain("## Slide 1");
    expect(result).toContain("## Slide 2");
    expect(result).toContain("Readable child");
    expect(result).not.toContain("private-note-sentinel");
    expect(result).not.toContain("PitchNotes");
    expect(countPitchSlides(source)).toBe(2);
  });
});
