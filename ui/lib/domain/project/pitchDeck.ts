import type { Root, RootContent } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import { z } from "zod";
import { mdxToAgentMarkdown } from "@/lib/content/agent-markdown";

export const PitchDeckSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  content: z.string().min(1),
});

export type PitchDeck = z.infer<typeof PitchDeckSchema>;

type MdxJsxFlowElement = RootContent & {
  type: "mdxJsxFlowElement";
  name: string;
  attributes: [];
  children: RootContent[];
};

function pitchSlide(children: RootContent[]): MdxJsxFlowElement {
  return {
    type: "mdxJsxFlowElement",
    name: "PitchSlide",
    attributes: [],
    children,
  } as MdxJsxFlowElement;
}

export function groupPitchSlides(tree: Root): void {
  const slides: RootContent[][] = [[]];

  for (const node of tree.children) {
    if (node.type === "thematicBreak") {
      slides.push([]);
      continue;
    }
    slides.at(-1)?.push(node);
  }

  const nonEmptySlides = slides.filter((slide) => slide.length > 0);
  tree.children = nonEmptySlides.map(pitchSlide);
}

export const remarkPitchSlides = () => groupPitchSlides;

function removePitchNotes(children: RootContent[]): RootContent[] {
  return children.flatMap((node) => {
    if (
      (node.type === "mdxJsxFlowElement" ||
        node.type === "mdxJsxTextElement") &&
      node.name === "PitchNotes"
    ) {
      return [];
    }

    if ("children" in node && Array.isArray(node.children)) {
      node.children = removePitchNotes(node.children as RootContent[]) as never;
    }
    return [node];
  });
}

function splitPitchSlides(children: RootContent[]): RootContent[][] {
  const slides: RootContent[][] = [[]];
  for (const node of children) {
    if (node.type === "thematicBreak") {
      slides.push([]);
      continue;
    }
    slides.at(-1)?.push(node);
  }
  return slides.filter((slide) => slide.length > 0);
}

export function pitchDeckToAgentMarkdown(
  content: string,
  convert: (mdx: string) => string = mdxToAgentMarkdown,
): string {
  const processor = remark().use(remarkMdx).use(remarkGfm);
  const tree = processor.parse(content) as Root;
  tree.children = removePitchNotes(tree.children);

  return splitPitchSlides(tree.children)
    .map((children, index) => {
      const slideSource = processor.stringify({ type: "root", children });
      return `## Slide ${index + 1}\n\n${convert(slideSource).trim()}`;
    })
    .join("\n\n");
}
