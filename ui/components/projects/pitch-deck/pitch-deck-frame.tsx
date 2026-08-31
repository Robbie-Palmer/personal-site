"use client";

import { Deck } from "@revealjs/react";
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  Expand,
  FileText,
  LayoutGrid,
  Presentation,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RevealApi, RevealConfig, RevealPlugin } from "reveal.js";

interface PitchDeckFrameProps {
  children: React.ReactNode;
  projectSlug?: string;
  title: string;
  mode: "embedded" | "focused";
  plugins?: RevealPlugin[];
  showPresenterTools?: boolean;
}

type Position = {
  current: number;
  total: number;
  atStart: boolean;
  atEnd: boolean;
};

const initialPosition: Position = {
  current: 1,
  total: 1,
  atStart: true,
  atEnd: false,
};

export function PitchDeckFrame({
  children,
  projectSlug,
  title,
  mode,
  plugins = [],
  showPresenterTools = false,
}: Readonly<PitchDeckFrameProps>) {
  const deckRef = useRef<RevealApi | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scrollView, setScrollView] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const restoreFocus = () => {
      if (!document.fullscreenElement) fullscreenButtonRef.current?.focus();
    };
    document.addEventListener("fullscreenchange", restoreFocus);
    return () => document.removeEventListener("fullscreenchange", restoreFocus);
  }, []);

  const updatePosition = useCallback(() => {
    const deck = deckRef.current;
    if (!deck) return;
    setPosition({
      current: deck.getSlidePastCount() + 1,
      total: Math.max(deck.getTotalSlides(), 1),
      atStart: deck.isFirstSlide(),
      atEnd: deck.isLastSlide(),
    });
  }, []);

  const config = useMemo<RevealConfig>(
    () => ({
      width: 1280,
      height: 720,
      margin: 0.055,
      embedded: mode === "embedded",
      keyboardCondition: mode === "embedded" ? "focused" : null,
      hash: mode === "focused",
      hashOneBasedIndex: mode === "focused",
      history: mode === "focused",
      autoSlide: false,
      transition: reducedMotion ? "none" : "slide",
      backgroundTransition: reducedMotion ? "none" : "fade",
      controls: false,
      progress: false,
      slideNumber: false,
      view: scrollView ? "scroll" : null,
      scrollActivationWidth: 700,
      scrollLayout: "compact",
      scrollSnap: "proximity",
    }),
    [mode, reducedMotion, scrollView],
  );

  const openSpeakerView = () => {
    const notes = deckRef.current?.getPlugin("notes") as
      | { open?: () => void }
      | undefined;
    notes?.open?.();
  };

  const enterFullscreen = async () => {
    await shellRef.current?.requestFullscreen();
  };

  const hasPresenterTools = mode === "focused" || showPresenterTools;

  return (
    <section
      ref={shellRef}
      className={`pitch-deck pitch-deck--${mode}`}
      aria-label={`${title} presentation`}
    >
      {hasPresenterTools && (
        <div className="pitch-deck__topbar">
          {mode === "focused" && projectSlug && (
            <Link
              href={`/projects/${projectSlug}`}
              className="pitch-deck__back"
            >
              <ArrowLeft aria-hidden="true" />
              Back to project
            </Link>
          )}
          <span className="pitch-deck__title">{title}</span>
          <div className="pitch-deck__tools">
            <button
              type="button"
              onClick={() => deckRef.current?.toggleOverview()}
              title="Slide overview"
            >
              <LayoutGrid aria-hidden="true" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setScrollView((current) => !current)}
              aria-pressed={scrollView}
              title="Toggle scroll view"
            >
              <Columns3 aria-hidden="true" />
              <span>{scrollView ? "Slides" : "Scroll"}</span>
            </button>
            <button
              type="button"
              onClick={openSpeakerView}
              title="Speaker view"
            >
              <Presentation aria-hidden="true" />
              <span>Speaker</span>
            </button>
            <button
              ref={fullscreenButtonRef}
              type="button"
              onClick={enterFullscreen}
              title="Enter fullscreen"
            >
              <Expand aria-hidden="true" />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>
      )}

      <div className="pitch-deck__stage">
        <Deck
          deckRef={deckRef}
          config={config}
          plugins={plugins}
          className="project-pitch-reveal"
          onReady={updatePosition}
          onSlideChange={updatePosition}
          onSync={updatePosition}
        >
          {children}
        </Deck>
      </div>

      <div className="pitch-deck__controls">
        <div className="pitch-deck__navigation">
          <button
            type="button"
            onClick={() => deckRef.current?.prev()}
            disabled={position.atStart}
            aria-label="Previous slide"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => deckRef.current?.next()}
            disabled={position.atEnd}
            aria-label="Next slide"
          >
            <ArrowRight aria-hidden="true" />
          </button>
          <span
            className="pitch-deck__position"
            aria-live="polite"
            aria-atomic="true"
          >
            Slide {position.current} of {position.total}
          </span>
        </div>

        {projectSlug && (
          <div className="pitch-deck__links">
            <a href={`/projects/${projectSlug}/deck.md`}>
              <FileText aria-hidden="true" />
              Transcript
            </a>
            {mode === "embedded" ? (
              <Link href={`/projects/${projectSlug}/deck`}>
                <Expand aria-hidden="true" />
                Open deck
              </Link>
            ) : (
              <a href={`/projects/${projectSlug}/deck?print-pdf`}>
                <FileText aria-hidden="true" />
                Print PDF
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
