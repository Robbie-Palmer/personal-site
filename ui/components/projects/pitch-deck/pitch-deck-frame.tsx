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
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  presentationHref?: string;
  printHref?: string;
  projectSlug?: string;
  title: string;
  mode: "embedded" | "focused";
  plugins?: RevealPlugin[];
  showPresenterTools?: boolean;
  showSpeakerView?: boolean;
}

type Position = {
  current: number;
  total: number;
  atStart: boolean;
  atEnd: boolean;
};

type RevealApiWithScrollView = RevealApi & {
  isScrollView: () => boolean;
  toggleScrollView: (override?: boolean) => void;
};

const initialPosition: Position = {
  current: 1,
  total: 1,
  atStart: true,
  atEnd: false,
};

export function PitchDeckFrame({
  backHref,
  backLabel,
  children,
  presentationHref,
  printHref,
  projectSlug,
  title,
  mode,
  plugins = [],
  showPresenterTools = false,
  showSpeakerView = true,
}: Readonly<PitchDeckFrameProps>) {
  const deckRef = useRef<RevealApi | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [narrowLayout, setNarrowLayout] = useState(false);
  const [scrollView, setScrollView] = useState(false);
  const [overview, setOverview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const resolvedBackHref =
    backHref ?? (projectSlug ? `/projects/${projectSlug}` : undefined);
  const resolvedBackLabel =
    backLabel ?? (projectSlug ? "Back to project" : "Back");
  const resolvedPresentationHref =
    presentationHref ??
    (projectSlug ? `/projects/${projectSlug}/deck` : undefined);
  const resolvedPrintHref =
    printHref ??
    (projectSlug ? `/projects/${projectSlug}/deck?print-pdf` : undefined);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => setNarrowLayout(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const updatePosition = useCallback((readyDeck?: RevealApi) => {
    const deck = readyDeck ?? deckRef.current;
    if (!deck) return;
    setPosition({
      current: deck.getSlidePastCount() + 1,
      total: Math.max(deck.getTotalSlides(), 1),
      atStart: deck.isFirstSlide(),
      atEnd: deck.isLastSlide(),
    });
  }, []);
  const handleReady = useCallback(
    (deck: RevealApi) => {
      updatePosition(deck);

      const search = new URLSearchParams(window.location.search);
      const shouldStartInScrollView =
        window.matchMedia("(max-width: 700px)").matches &&
        !search.has("print-pdf");

      if (shouldStartInScrollView) {
        const deckWithScrollView = deck as RevealApiWithScrollView;
        deckWithScrollView.configure({ view: "scroll" });
        deckWithScrollView.toggleScrollView(true);
        setScrollView(deckWithScrollView.isScrollView());
      }

      if (mode === "focused" && search.has("print-pdf")) {
        let opened = false;
        let layoutChecks = 0;
        const openPrintDialog = () => {
          if (opened) return;
          opened = true;
          requestAnimationFrame(() => window.print());
        };
        const waitForPrintLayout = () => {
          if (document.querySelector(".pdf-page")) {
            openPrintDialog();
          } else if (layoutChecks < 300) {
            layoutChecks += 1;
            requestAnimationFrame(waitForPrintLayout);
          }
        };

        deck.on("pdf-ready", openPrintDialog);
        waitForPrintLayout();
      }
    },
    [mode, updatePosition],
  );
  const handlePositionEvent = useCallback(
    () => updatePosition(),
    [updatePosition],
  );

  useEffect(() => {
    let layoutFrame = 0;
    const syncFullscreen = () => {
      const active = document.fullscreenElement === shellRef.current;
      setIsFullscreen(active);
      if (!active) fullscreenButtonRef.current?.focus();

      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => {
        deckRef.current?.layout();
        updatePosition();
      });
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      cancelAnimationFrame(layoutFrame);
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, [updatePosition]);

  const config = useMemo<RevealConfig>(
    () => ({
      height: narrowLayout ? 960 : 720,
      width: narrowLayout ? 720 : 1280,
      margin: 0.055,
      embedded: true,
      keyboardCondition: mode === "embedded" ? "focused" : null,
      hash: mode === "focused",
      hashOneBasedIndex: mode === "focused",
      history: mode === "focused",
      autoSlide: false,
      transition: reducedMotion ? "none" : "slide",
      backgroundTransition: reducedMotion ? "none" : "fade",
      controls: false,
      progress: false,
      pdfSeparateFragments: false,
      slideNumber: false,
      view: scrollView ? "scroll" : null,
      scrollActivationWidth: 0,
      scrollLayout: "compact",
      scrollSnap: "proximity",
    }),
    [mode, narrowLayout, reducedMotion, scrollView],
  );

  const toggleOverview = () => {
    const deck = deckRef.current as RevealApiWithScrollView | null;
    if (!deck) return;

    if (deck.isScrollView()) {
      deck.toggleScrollView(false);
      setScrollView(false);
    }
    deck.toggleOverview();
    setOverview(deck.isOverview());
  };

  const toggleScrollView = () => {
    const deck = deckRef.current as RevealApiWithScrollView | null;
    if (!deck) return;

    if (deck.isOverview()) {
      deck.toggleOverview(false);
      setOverview(false);
    }
    const activating = !deck.isScrollView();
    if (activating) deck.configure({ view: "scroll" });
    deck.toggleScrollView(activating);
    if (!activating) deck.configure({ view: null });
    setScrollView(deck.isScrollView());
    updatePosition(deck);
  };

  const handleOverviewShown = () => {
    const slides = deckRef.current
      ?.getSlidesElement()
      ?.querySelectorAll(":scope > section");
    slides?.forEach((slide) => {
      slide.removeAttribute("hidden");
      slide.removeAttribute("aria-hidden");
    });
    setOverview(true);
  };

  const openSpeakerView = () => {
    const notes = deckRef.current?.getPlugin("notes") as
      | { open?: () => void }
      | undefined;
    notes?.open?.();
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === shellRef.current) {
        await document.exitFullscreen();
      } else {
        await shellRef.current?.requestFullscreen();
      }
    } catch {
      fullscreenButtonRef.current?.focus();
    }
  };

  const hasPresenterTools = mode === "focused" || showPresenterTools;
  let deckActionLink: React.ReactNode = null;
  if (mode === "embedded" && resolvedPresentationHref) {
    deckActionLink = (
      <Link
        href={resolvedPresentationHref}
        aria-label="Open deck"
        title="Open deck"
      >
        <Expand aria-hidden="true" />
        <span>Open deck</span>
      </Link>
    );
  } else if (mode === "focused" && resolvedPrintHref) {
    deckActionLink = (
      <a
        href={resolvedPrintHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Print PDF"
        title="Print PDF"
      >
        <FileText aria-hidden="true" />
        <span>Print PDF</span>
      </a>
    );
  }

  return (
    <section
      ref={shellRef}
      className={`pitch-deck pitch-deck--${mode}`}
      aria-label={`${title} presentation`}
    >
      {hasPresenterTools && (
        <div className="pitch-deck__topbar">
          {mode === "focused" && resolvedBackHref && (
            <Link href={resolvedBackHref} className="pitch-deck__back">
              <ArrowLeft aria-hidden="true" />
              {resolvedBackLabel}
            </Link>
          )}
          <span className="pitch-deck__title">{title}</span>
          <div className="pitch-deck__tools">
            {mode === "embedded" && resolvedPresentationHref && (
              <Link href={resolvedPresentationHref}>
                <Presentation aria-hidden="true" />
                <span>Present</span>
              </Link>
            )}
            <button
              type="button"
              onClick={toggleOverview}
              aria-pressed={overview}
              title="Slide overview"
            >
              <LayoutGrid aria-hidden="true" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={toggleScrollView}
              aria-pressed={scrollView}
              title="Toggle scroll view"
            >
              <Columns3 aria-hidden="true" />
              <span>{scrollView ? "Slides" : "Scroll"}</span>
            </button>
            {showSpeakerView && (
              <button
                type="button"
                onClick={openSpeakerView}
                title="Speaker view"
              >
                <Presentation aria-hidden="true" />
                <span>Speaker</span>
              </button>
            )}
            <button
              ref={fullscreenButtonRef}
              type="button"
              onClick={() => void toggleFullscreen()}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <Expand aria-hidden="true" />
              <span>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
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
          onReady={handleReady}
          onSlideChange={handlePositionEvent}
          onSync={handlePositionEvent}
          onOverviewShown={handleOverviewShown}
          onOverviewHidden={() => setOverview(false)}
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

        {(projectSlug || resolvedPrintHref) && (
          <div className="pitch-deck__links">
            {projectSlug && (
              <a
                href={`/projects/${projectSlug}/deck.md`}
                aria-label="Transcript"
                title="Read transcript"
              >
                <FileText aria-hidden="true" />
                <span>Transcript</span>
              </a>
            )}
            {deckActionLink}
          </div>
        )}
      </div>
    </section>
  );
}
