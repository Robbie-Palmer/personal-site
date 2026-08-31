import { EmbeddedPitchDeckContent } from "@/components/projects/pitch-deck/embedded-pitch-deck-content";
import { ReviewDepthDemo } from "@/components/projects/pitch-deck/review-depth-demo";
import { REVEALJS_DEMO_SOURCE } from "./revealjs-demo-source";

export function RevealJsDemoContent() {
  return (
    <EmbeddedPitchDeckContent
      source={REVEALJS_DEMO_SOURCE}
      components={{ ReviewDepthDemo }}
    />
  );
}
