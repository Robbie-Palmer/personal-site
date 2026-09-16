import { ArrowUpRight } from "lucide-react";
import { posthogApplication } from "@/content/posthog";
import { cn } from "@/lib/generic/styles";
import styles from "./posthog.module.css";

export function CultureSection() {
  const { culture } = posthogApplication;

  return (
    <section
      id="culture"
      className="scroll-mt-20 border-b-2 border-[var(--hog-ink)] bg-[var(--hog-paper-deep)]"
    >
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-red)]">
              {culture.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              {culture.heading}
            </h2>
          </div>
          <p className="self-end text-xl font-bold leading-9">
            {culture.intro}
          </p>
        </div>

        <div className="mt-14 grid gap-7 lg:grid-cols-2">
          {culture.stories.map((story) => (
            <article
              className={cn(styles.paperPanel, "flex min-h-full flex-col p-7")}
              key={story.number}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--hog-ink)] bg-[var(--hog-yellow)] font-mono text-xs font-black">
                  {story.number}
                </span>
                <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-black/55">
                  {story.eyebrow}
                </p>
              </div>
              <h3 className="mt-6 text-3xl font-black leading-tight tracking-[-0.03em]">
                {story.title}
              </h3>
              <p className="mt-5 flex-1 font-bold leading-7 text-black/70">
                {story.description}
              </p>
              <a
                className="mt-7 inline-flex items-center gap-2 self-start text-sm font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                href={story.link.href}
                rel="noreferrer"
                target="_blank"
              >
                {story.link.label}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-7 lg:grid-cols-2">
          <a
            className={cn(
              styles.evidenceCard,
              "group flex min-h-full flex-col p-7 sm:p-9",
            )}
            href={culture.publicWork.href}
            rel="noreferrer"
            target="_blank"
          >
            <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[var(--hog-green)]">
              {culture.publicWork.eyebrow}
            </p>
            <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em]">
              {culture.publicWork.heading}
            </h3>
            <p className="mt-5 flex-1 font-bold leading-7 text-black/70">
              {culture.publicWork.description}
            </p>
            <span className="mt-7 inline-flex items-center gap-2 self-start font-black underline decoration-2 underline-offset-4">
              {culture.publicWork.linkLabel}
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </a>

          <article className="border-2 border-[var(--hog-ink)] bg-[var(--hog-yellow)] p-7 shadow-[7px_7px_0_var(--hog-ink)] sm:p-9">
            <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-black/55">
              {culture.whyNow.eyebrow}
            </p>
            <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em]">
              {culture.whyNow.heading}
            </h3>
            <p className="mt-5 font-bold leading-7 text-black/70">
              {culture.whyNow.description}
            </p>
          </article>
        </div>

        <div className="mt-12 grid gap-8 border-t-2 border-[var(--hog-ink)] pt-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-blue)]">
              {culture.closing.eyebrow}
            </p>
            <h3 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
              {culture.closing.heading}
            </h3>
          </div>
          <div>
            <div className="space-y-5 text-lg font-bold leading-8">
              {culture.closing.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <a
              className="mt-7 inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={culture.closing.href}
              rel="noreferrer"
              target="_blank"
            >
              {culture.closing.linkLabel}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
