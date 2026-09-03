"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const speakerMessageNamespace = "pitch-deck-presenter";

type PresenterState = {
  current: number;
  total: number | null;
  notes: string;
};

function slideFromHash(): number {
  if (typeof window === "undefined") return 0;
  const slideMatch = /^#\/(\d+)/.exec(window.location.hash);
  const oneBasedSlide = Number.parseInt(slideMatch?.[1] ?? "1", 10);
  return Math.max(0, oneBasedSlide - 1);
}

function receiverUrl(deckHref: string, slide: number): string {
  const params = new URLSearchParams({
    receiver: "",
    fragments: "false",
    progress: "false",
    history: "false",
    transition: "none",
    autoSlide: "0",
    backgroundTransition: "none",
    scrollActivationWidth: "false",
  });
  return `${deckHref}?${params}#/${slide + 1}`;
}

export function PitchDeckPresenter({
  deckHref,
  title,
}: Readonly<{ deckHref: string; title: string }>) {
  const initialSlide = useMemo(slideFromHash, []);
  const currentFrameRef = useRef<HTMLIFrameElement>(null);
  const upcomingFrameRef = useRef<HTMLIFrameElement>(null);
  const connectedRef = useRef(false);
  const [state, setState] = useState<PresenterState>({
    current: initialSlide,
    total: null,
    notes: "",
  });

  const syncFrame = useCallback(
    (frame: HTMLIFrameElement | null, slide: number) => {
      frame?.contentWindow?.postMessage(
        JSON.stringify({ method: "slide", args: [slide] }),
        window.location.origin,
      );
    },
    [],
  );

  const navigate = useCallback((direction: "previous" | "next") => {
    window.opener?.postMessage(
      { namespace: speakerMessageNamespace, type: "navigate", direction },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const handleState = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.opener ||
        event.data?.namespace !== speakerMessageNamespace ||
        event.data.type !== "state" ||
        typeof event.data.current !== "number" ||
        typeof event.data.total !== "number" ||
        typeof event.data.notes !== "string"
      ) {
        return;
      }
      connectedRef.current = true;
      const nextState: PresenterState = {
        current: event.data.current,
        total: event.data.total,
        notes: event.data.notes,
      };
      setState(nextState);
      window.history.replaceState(null, "", `#/${nextState.current + 1}`);
      syncFrame(currentFrameRef.current, nextState.current);
      syncFrame(
        upcomingFrameRef.current,
        Math.min(nextState.current + 1, event.data.total - 1),
      );
    };
    window.addEventListener("message", handleState);
    const connect = () => {
      if (connectedRef.current) return;
      window.opener?.postMessage(
        { namespace: speakerMessageNamespace, type: "connect" },
        window.location.origin,
      );
    };
    connect();
    const reconnectTimer = window.setInterval(connect, 500);
    return () => {
      window.clearInterval(reconnectTimer);
      window.removeEventListener("message", handleState);
    };
  }, [syncFrame]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        navigate("previous");
      } else if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        navigate("next");
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [navigate]);

  const upcoming =
    state.total === null
      ? state.current + 1
      : Math.min(state.current + 1, state.total - 1);

  return (
    <main className="pitch-presenter">
      <section className="pitch-presenter__current" aria-label="Current slide">
        <span className="pitch-presenter__label">Current</span>
        <iframe
          ref={currentFrameRef}
          title="Current slide"
          data-presenter-frame="current"
          src={receiverUrl(deckHref, state.current)}
          onLoad={() => syncFrame(currentFrameRef.current, state.current)}
        />
      </section>
      <aside className="pitch-presenter__side">
        <section className="pitch-presenter__upcoming" aria-label="Next slide">
          <span className="pitch-presenter__label">Next</span>
          <iframe
            ref={upcomingFrameRef}
            title="Next slide"
            data-presenter-frame="upcoming"
            src={receiverUrl(deckHref, upcoming)}
            onLoad={() => syncFrame(upcomingFrameRef.current, upcoming)}
          />
        </section>
        <section className="pitch-presenter__notes" aria-label="Speaker notes">
          <div className="pitch-presenter__notes-header">
            <span>Speaker notes</span>
            <span>
              {state.current + 1} / {state.total ?? "–"}
            </span>
          </div>
          <p className="pitch-presenter__notes-body">
            {state.notes || "No speaker notes for this slide."}
          </p>
          <div className="pitch-presenter__navigation">
            <button
              type="button"
              aria-label="Previous slide"
              disabled={state.current === 0}
              onClick={() => navigate("previous")}
            >
              <ArrowLeft aria-hidden="true" />
            </button>
            <strong>{title}</strong>
            <button
              type="button"
              aria-label="Next slide"
              disabled={
                state.total !== null && state.current >= state.total - 1
              }
              onClick={() => navigate("next")}
            >
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}
