import type { Metadata } from "next";
import { FocusedRevealJsDemo } from "@/components/technology/focused-revealjs-demo";
import { RevealJsDemoContent } from "@/components/technology/revealjs-demo-content";

export const metadata: Metadata = {
  title: "reveal.js integration demo",
  description:
    "A focused presentation demonstrating the site's reveal.js integration.",
};

export default function RevealJsDemoDeckPage() {
  return (
    <FocusedRevealJsDemo>
      <RevealJsDemoContent />
    </FocusedRevealJsDemo>
  );
}
