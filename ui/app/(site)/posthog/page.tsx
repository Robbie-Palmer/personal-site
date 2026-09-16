import hedgehogDeskWizardPng from "@posthog/brand/hoggies/png/desk-wizard";
import { Logo } from "@posthog/brand/logo";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Github,
  MapPin,
  Network,
} from "lucide-react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  type PostHogApplicationLink,
  posthogApplication,
} from "@/content/posthog";
import { cn } from "@/lib/generic/styles";
import styles from "./posthog.module.css";

const roundHog = localFont({
  src: [
    {
      path: "../../../node_modules/@posthog/brand/dist/fonts/RoundHog.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@posthog/brand/dist/fonts/RoundHog-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../../node_modules/@posthog/brand/dist/fonts/RoundHog-SemiBold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../../node_modules/@posthog/brand/dist/fonts/RoundHog-Bold.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-roundhog",
});

export const metadata: Metadata = {
  title: "A speculative application to PostHog",
  description: posthogApplication.description,
  alternates: {
    canonical: "/posthog",
    types: { "text/markdown": "/posthog.md" },
  },
  openGraph: {
    title: "PostHog, I want to help products drive themselves",
    description: posthogApplication.description,
    url: "/posthog",
  },
};

function EvidenceLink({ link }: { readonly link: PostHogApplicationLink }) {
  const content = (
    <>
      {link.label}
      {link.external ? (
        <ArrowUpRight className="size-4" aria-hidden="true" />
      ) : (
        <ArrowRight className="size-4" aria-hidden="true" />
      )}
    </>
  );
  const className =
    "inline-flex items-center gap-1.5 text-sm font-bold underline decoration-2 underline-offset-4 hover:decoration-[var(--hog-red)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4";

  if (link.external) {
    return (
      <a
        className={className}
        href={link.href}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={link.href}>
      {content}
    </Link>
  );
}

const stageColours = ["#f5c842", "#f05b52", "#1490e8", "#4e9b75"];

export default function PostHogApplicationPage() {
  return (
    <div className={cn(styles.page, roundHog.variable)}>
      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12">
        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-3 text-lg font-bold">
            <span>Dear</span>
            <Logo size={132} title="PostHog" />
            <span>,</span>
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.045em] sm:text-6xl lg:text-7xl xl:text-[5.6rem]">
            I want to help products{" "}
            <span className={styles.scribble}>drive themselves</span>.
          </h1>
          <a
            className={cn(styles.heroTeaser, "group mt-7 block max-w-2xl")}
            href="#specific-weirdness"
          >
            <div className="flex items-center justify-between gap-4 border-b-2 border-[var(--hog-ink)] px-3 py-2.5 sm:px-4">
              <p className="text-xs font-black uppercase tracking-[0.15em] sm:text-sm">
                A preview of the weirdness
              </p>
              <span className="shrink-0 text-xs font-black underline decoration-2 underline-offset-2">
                See the through-line ↓
              </span>
            </div>
            <div className="grid grid-cols-4">
              {posthogApplication.weirdness.artefacts
                .slice(0, 4)
                .map((artefact) => (
                  <div
                    className={cn(
                      styles.heroTeaserItem,
                      "relative aspect-square overflow-hidden",
                    )}
                    key={artefact.title}
                  >
                    <Image
                      alt=""
                      className={
                        artefact.imageFit === "contain"
                          ? "size-full object-contain"
                          : "size-full object-cover"
                      }
                      height={artefact.imageHeight}
                      priority
                      sizes="(min-width: 640px) 160px, 25vw"
                      src={artefact.image}
                      width={artefact.imageWidth}
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-[var(--hog-ink)]/90 px-1.5 py-1 text-center text-[0.58rem] font-black uppercase tracking-[0.08em] text-white sm:px-2 sm:py-1.5 sm:text-xs">
                      {artefact.shortTitle}
                    </span>
                  </div>
                ))}
            </div>
          </a>
          <p className="mt-8 max-w-2xl text-lg font-medium leading-8 sm:text-xl">
            You are building the context and tools that let products understand
            what is happening and act on it. I have been building the loop
            around that thesis: prioritised work, bounded agents, strong review,
            and evidence that the change reached production.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center gap-2 border-2 border-[var(--hog-ink)] bg-[var(--hog-ink)] px-5 py-3 font-black text-[#fffdf8] shadow-[4px_4px_0_var(--hog-red)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4"
              href="#evidence"
            >
              Start with the proof
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <Link
              className="inline-flex items-center gap-2 border-2 border-[var(--hog-ink)] bg-[#fffdf8] px-5 py-3 font-black shadow-[4px_4px_0_var(--hog-ink)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.projects}
            >
              Explore my projects
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold">
            <span className="inline-flex items-center gap-2">
              <MapPin
                className="size-4 text-[var(--hog-red)]"
                aria-hidden="true"
              />
              Belfast, UK
            </span>
            <span className="inline-flex items-center gap-2">
              <Network
                className="size-4 text-[var(--hog-blue)]"
                aria-hidden="true"
              />
              Product · ML · systems · teams
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl pb-7 pt-48 sm:pt-56">
          <Image
            alt="Max the PostHog hedgehog working at a laptop"
            className={cn(
              styles.hoggie,
              "absolute -right-4 top-0 z-10 h-auto w-64 sm:right-3 sm:w-80",
            )}
            height={320}
            priority
            src={hedgehogDeskWizardPng}
            width={320}
          />
          <aside
            className={cn(
              styles.terminalPanel,
              "relative rotate-[1deg] p-5 sm:p-7",
            )}
          >
            <div className="mb-6 flex items-center gap-2 border-b border-white/20 pb-4">
              <span className="size-3 rounded-full bg-[var(--hog-red)]" />
              <span className="size-3 rounded-full bg-[var(--hog-yellow)]" />
              <span className="size-3 rounded-full bg-[var(--hog-green)]" />
              <span className="ml-auto font-mono text-xs text-white/55">
                evidence.log
              </span>
            </div>
            <div className="space-y-5 font-mono text-sm leading-6 sm:text-base">
              <p className="text-white/55">$ work-graph claim</p>
              <p className="break-words text-[var(--hog-yellow)]">
                posthog-application-landing-page
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-y border-white/20 py-5">
                <dt className="text-white/45">stage</dt>
                <dd>in_progress</dd>
                <dt className="text-white/45">lease</dt>
                <dd>fenced · renewable</dd>
                <dt className="text-white/45">proof</dt>
                <dd>merge + deployment</dd>
              </dl>
              <p className="flex items-start gap-2 text-[#bce7ce]">
                <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span>
                  This page is work moving through the system it describes.
                </span>
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y-2 border-[var(--hog-ink)] bg-[var(--hog-paper-deep)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-red)]">
                The overlap
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
                Same destination, different starting point.
              </h2>
            </div>
            <div className="space-y-6 text-lg font-medium leading-8">
              {posthogApplication.thesis.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            {posthogApplication.loop.map((stage, index) => (
              <article
                className={cn(
                  styles.loopStage,
                  "border-2 border-[var(--hog-ink)] bg-[#fffdf8] p-5",
                )}
                key={stage.title}
              >
                <div
                  className="mb-5 flex size-10 items-center justify-center rounded-full border-2 border-[var(--hog-ink)] font-mono text-sm font-black"
                  style={{
                    backgroundColor: stageColours[index],
                    color: index > 0 ? "#fffdf8" : "#1d1f1f",
                  }}
                >
                  {stage.step}
                </div>
                <h3 className="text-xl font-black">{stage.title}</h3>
                <p className="mt-2 text-sm font-medium leading-6">
                  {stage.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="specific-weirdness"
        className="scroll-mt-20 border-b-2 border-[var(--hog-ink)] bg-[var(--hog-ink)] text-[#fffdf8]"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-yellow)]">
              The specific weirdness
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              The subjects jump. The obsession does not.
            </h2>
            <blockquote
              className={cn(
                styles.weirdQuote,
                "mt-10 p-6 text-2xl font-black leading-tight sm:p-8 sm:text-3xl",
              )}
            >
              <p>&ldquo;{posthogApplication.weirdness.quote}&rdquo;</p>
              <footer className="mt-5 text-sm font-bold">
                {posthogApplication.weirdness.attribution}
              </footer>
            </blockquote>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-2xl font-black leading-snug sm:text-3xl">
              {posthogApplication.weirdness.intro}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {posthogApplication.weirdness.threads.map((thread) => (
                <span
                  className={cn(styles.thread, "px-4 py-2 text-sm font-black")}
                  key={thread}
                >
                  {thread}
                </span>
              ))}
            </div>
            <p className="mt-9 text-lg font-medium leading-8 text-white/80">
              {posthogApplication.weirdness.conclusion}
            </p>
            <a
              className="mt-6 border-l-4 border-[var(--hog-red)] bg-white/10 px-5 py-4 font-bold leading-7 text-white/90 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.weirdness.posthogParallelHref}
              target="_blank"
              rel="noreferrer"
            >
              {posthogApplication.weirdness.posthogParallel}
              <ArrowUpRight
                className="ml-2 inline size-4 align-[-0.1em]"
                aria-hidden="true"
              />
            </a>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-4">
              {posthogApplication.weirdness.projects.map((project) => (
                <Link
                  className="inline-flex items-center gap-1.5 font-black underline decoration-2 underline-offset-4 hover:decoration-[var(--hog-yellow)] focus-visible:outline-2 focus-visible:outline-offset-4"
                  href={project.href}
                  key={project.href}
                >
                  {project.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-10 lg:col-span-2">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-2 border-white/25 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-red)]">
                  Exhibit A through E
                </p>
                <h3 className="mt-2 text-3xl font-black sm:text-4xl">
                  What the weirdness looks like.
                </h3>
              </div>
              <p className="max-w-md text-sm font-bold leading-6 text-white/60">
                Five interfaces. Five domains. The same urge to turn a messy
                system into something visible, explorable, and useful.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {posthogApplication.weirdness.artefacts.map((artefact, index) => (
                <Link
                  className={cn(
                    styles.artefactCard,
                    "group block",
                    index === 4 && "md:col-span-2",
                    index % 2 === 0
                      ? "md:rotate-[-0.35deg]"
                      : "md:rotate-[0.35deg]",
                  )}
                  href={artefact.href}
                  key={artefact.title}
                  style={
                    {
                      "--artefact-accent": artefact.accent,
                    } as CSSProperties
                  }
                >
                  <div className="flex items-center gap-3 p-4 sm:p-5">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--hog-ink)] font-mono text-xs font-black"
                      style={{ backgroundColor: artefact.accent }}
                    >
                      {artefact.number}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-lg font-black">
                        {artefact.title}
                      </h4>
                      <p className="truncate font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-black/50">
                        {artefact.meta}
                      </p>
                    </div>
                    <ArrowUpRight
                      className="ml-auto size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <div
                    className={cn(
                      styles.artefactImage,
                      "relative aspect-[16/9]",
                    )}
                  >
                    <Image
                      alt={artefact.alt}
                      className={
                        artefact.imageFit === "contain"
                          ? "size-full object-contain"
                          : "size-full object-cover"
                      }
                      height={artefact.imageHeight}
                      sizes="(min-width: 768px) 42vw, 90vw"
                      src={artefact.image}
                      width={artefact.imageWidth}
                    />
                  </div>
                  <p className="p-5 font-bold leading-7 sm:p-6">
                    {artefact.description}
                    {"credit" in artefact && (
                      <span className="mt-3 block font-mono text-[0.65rem] font-black uppercase tracking-[0.12em] text-black/50">
                        {artefact.credit}
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="evidence" className="scroll-mt-20">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-blue)]">
              Direct evidence
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              The work is public. You can inspect it.
            </h2>
            <p className="mt-5 text-lg font-medium leading-8">
              These are working systems and recorded decisions, not portfolio
              mock-ups. Each link goes to the product, source, architecture, or
              merged change behind the claim.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {posthogApplication.evidence.map((item, index) => (
              <article
                className={cn(
                  styles.evidenceCard,
                  "flex min-h-full flex-col p-6 sm:p-8",
                )}
                key={item.title}
              >
                <div className="mb-8 flex items-center gap-3">
                  <span
                    className="block h-3 w-12 border-2 border-[var(--hog-ink)]"
                    style={{ backgroundColor: stageColours[index] }}
                  />
                  <span className="text-xs font-black uppercase tracking-[0.18em]">
                    {item.eyebrow}
                  </span>
                </div>
                <h3 className="text-3xl font-black leading-tight tracking-[-0.03em]">
                  {item.title}
                </h3>
                <p className="mt-5 flex-1 font-medium leading-7">
                  {item.description}
                </p>
                <div className="mt-8 flex flex-col items-start gap-4">
                  {item.links.map((link) => (
                    <EvidenceLink key={link.href} link={link} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-[var(--hog-ink)] bg-[var(--hog-yellow)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                What I bring
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
                One builder across the whole loop.
              </h2>
              <Link
                className="mt-7 inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                href={posthogApplication.links.experience}
              >
                Resume and experience
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {posthogApplication.experience.map((item) => (
                <article
                  className="border-t-2 border-[var(--hog-ink)] pt-4"
                  key={item.title}
                >
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-2 font-medium leading-7">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:px-12">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-green)]">
            Where I might fit
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">
            Useful range, without pretending the constraints do not exist.
          </h2>
          <div className="mt-8 space-y-5 text-lg font-medium leading-8">
            {posthogApplication.fit.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <aside className={cn(styles.paperPanel, "self-start p-6 sm:p-9")}>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--hog-red)]">
            The ask
          </p>
          <p className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em]">
            {posthogApplication.ask}
          </p>
          <div className="mt-8 flex flex-col items-start gap-4">
            <Link
              className="inline-flex w-full items-center justify-between gap-3 border-2 border-[var(--hog-ink)] bg-[var(--hog-ink)] px-5 py-3 font-black text-[#fffdf8] shadow-[4px_4px_0_var(--hog-red)] focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.initiative}
            >
              Read what I am building toward
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.productDemo}
            >
              Try the product demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.technicalDemo}
            >
              Run the technical demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              className="inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.github}
              target="_blank"
              rel="noreferrer"
            >
              <Github className="size-4" aria-hidden="true" />
              Inspect my GitHub
            </a>
            <a
              className="inline-flex items-center gap-2 font-black underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={posthogApplication.links.linkedin}
              target="_blank"
              rel="noreferrer"
            >
              Connect on LinkedIn
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </aside>
      </section>
    </div>
  );
}
