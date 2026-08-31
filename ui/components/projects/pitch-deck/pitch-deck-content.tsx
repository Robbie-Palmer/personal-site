import { MarkdownContent } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { remarkPitchSlides } from "@/lib/domain/project/pitchDeck";
import {
  PitchColumn,
  PitchColumns,
  PitchNotes,
  PitchSlide,
  PitchStep,
} from "./pitch-components";
import { ReviewDepthDemo } from "./review-depth-demo";

const pitchComponents = {
  Mermaid,
  PitchColumn,
  PitchColumns,
  PitchNotes,
  PitchSlide,
  PitchStep,
  ReviewDepthDemo,
};

export function PitchDeckContent({ source }: Readonly<{ source: string }>) {
  return (
    <MarkdownContent
      source={source}
      components={pitchComponents}
      remarkPlugins={[remarkPitchSlides]}
    />
  );
}
