import { MarkdownContent, type MarkdownProps } from "@/components/markdown";
import { Mermaid } from "@/components/mermaid";
import { remarkPitchSlides } from "@/lib/domain/project/pitchDeck";

function EmbeddedPitchSlide({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="pitch-slide">
      <div className="pitch-slide__content">{children}</div>
    </section>
  );
}

export function EmbeddedPitchStep({
  children,
  index,
}: Readonly<{ children: React.ReactNode; index?: number }>) {
  return (
    <div className="fragment fade-up pitch-step" data-fragment-index={index}>
      {children}
    </div>
  );
}

function EmbeddedPitchNotes({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <aside className="notes">{children}</aside>;
}

function PitchColumns({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="pitch-columns">{children}</div>;
}

function PitchColumn({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="pitch-column">{children}</div>;
}

function ReviewDepthPreview() {
  return (
    <div className="review-depth-demo review-depth-demo--preview">
      <p>
        <strong>Routine</strong>
        <br />
        One fast reviewer
      </p>
      <p>
        <strong>Material</strong>
        <br />
        Two independent reviewers
      </p>
      <p>
        <strong>Sensitive</strong>
        <br />
        Three specialist passes
      </p>
    </div>
  );
}

const embeddedPitchComponents = {
  Mermaid,
  PitchColumn,
  PitchColumns,
  PitchNotes: EmbeddedPitchNotes,
  PitchSlide: EmbeddedPitchSlide,
  PitchStep: EmbeddedPitchStep,
  ReviewDepthDemo: ReviewDepthPreview,
};

export function EmbeddedPitchDeckContent({
  source,
  components,
}: Readonly<{
  source: string;
  components?: MarkdownProps["components"];
}>) {
  return (
    <MarkdownContent
      source={source}
      components={{ ...embeddedPitchComponents, ...components }}
      remarkPlugins={[remarkPitchSlides]}
    />
  );
}
