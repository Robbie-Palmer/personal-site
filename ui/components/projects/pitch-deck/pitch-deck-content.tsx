import { MarkdownContent } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { TechIcon } from "@/lib/api/tech-icons";
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
  TechIcon,
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
