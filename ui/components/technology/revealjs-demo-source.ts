export const REVEALJS_DEMO_SOURCE = String.raw`# reveal.js, inside the site

This deck is MDX rendered with the site's React components and presentation controls.

<PitchNotes>
  Speaker notes stay attached to the slide source and open through the toolbar.
</PitchNotes>

---

## Mermaid remains a live component

<Mermaid chart={"flowchart LR\n  A[MDX source] --> B[remark pipeline]\n  B --> C[React components]\n  C --> D[reveal.js deck]\n  D --> E[Static export]"} />

---

## Shiki highlights code before hydration

~~~ts {2-4}
type SlideDefinition = {
  source: string
  notes?: string
  transition?: "none" | "fade" | "slide"
}
~~~

---

## Fragments reveal in a fixed order

<PitchStep index={0}>**First click.** Read the MDX.</PitchStep>

<PitchStep index={1}>**Second click.** Mount normal React components.</PitchStep>

<PitchStep index={2}>**Third click.** Let reveal.js handle presentation state.</PitchStep>

---

## React state stays interactive

Choose a review depth. The count and explanation update inside the slide.

<ReviewDepthDemo />

---

## One source supports several reading modes

<PitchColumns>
  <PitchColumn>
    ### Present

    Keyboard navigation, fragments, overview, speaker notes, fullscreen, and scroll view.
  </PitchColumn>
  <PitchColumn>
    ### Publish

    Embedded decks, focused routes, print output, and plain-text transcripts.
  </PitchColumn>
</PitchColumns>

<PitchNotes>
  The project integration decides which controls and links surround this shared deck frame.
</PitchNotes>`;
