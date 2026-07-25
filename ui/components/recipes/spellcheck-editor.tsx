"use client";

import { Check, SpellCheck, X } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTypoDictionary } from "@/hooks/use-typo-dictionary";
import {
  applyCorrection,
  findMisspellings,
  type Misspelling,
} from "@/lib/domain/recipe/spellcheck";
import { cn } from "@/lib/generic/styles";

// Typography/layout classes shared by the editable textarea and the highlight
// backdrop drawn over it. They must match exactly so highlighted ranges line up
// with the caret; only colour/interaction differs between the two layers.
const SHARED_BOX =
  "rt-body min-h-[360px] w-full rounded-lg border border-[var(--line-strong)] p-3 text-base leading-relaxed";

interface SpellcheckEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly ariaLabel?: string;
}

/**
 * Cooklang text editor with inline, `typos`-parity spell-checking. Misspellings
 * are underlined in a highlight layer over the textarea; clicking one (or using
 * the issues summary) accepts a suggested correction or dismisses it — the
 * document-editor experience the repo's pre-commit `typos` gate used to provide
 * for file-based recipes.
 */
export function SpellcheckEditor({
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
}: SpellcheckEditorProps) {
  const { dictionary, ready } = useTypoDictionary();
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const backdropRef = useRef<HTMLDivElement>(null);

  const misspellings = useMemo(
    () => (dictionary ? findMisspellings(value, dictionary, ignored) : []),
    [dictionary, value, ignored],
  );

  const accept = (misspelling: Misspelling, replacement: string) => {
    onChange(applyCorrection(value, misspelling, replacement));
  };

  const ignore = (word: string) => {
    setIgnored((prev) => new Set(prev).add(word.toLowerCase()));
  };

  const fixAll = () => {
    // Apply right-to-left so earlier offsets stay valid as text length changes.
    const next = [...misspellings]
      .sort((a, b) => b.start - a.start)
      .reduce((text, m) => {
        const replacement = m.suggestions[0];
        return replacement ? applyCorrection(text, m, replacement) : text;
      }, value);
    onChange(next);
  };

  const fixableCount = misspellings.filter(
    (m) => m.suggestions.length > 0,
  ).length;

  return (
    <div className="grid gap-2">
      <SpellcheckSummary
        ready={ready}
        misspellings={misspellings}
        fixableCount={fixableCount}
        onFixAll={fixAll}
        onAccept={accept}
        onIgnore={ignore}
      />
      <div className="relative">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            const backdrop = backdropRef.current;
            if (backdrop) {
              backdrop.scrollTop = event.currentTarget.scrollTop;
              backdrop.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-label={ariaLabel}
          // Our curated check replaces the browser's, so its squiggles don't
          // double up with ours.
          spellCheck={false}
          className={cn(
            SHARED_BOX,
            "relative z-0 block resize-y bg-[var(--paper)] text-transparent caret-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--ink-4)] focus:border-[var(--terracotta)] focus:ring-3 focus:ring-[var(--terracotta)]/15",
          )}
        />
        <HighlightBackdrop
          ref={backdropRef}
          value={value}
          misspellings={misspellings}
          onAccept={accept}
          onIgnore={ignore}
        />
      </div>
    </div>
  );
}

function SpellcheckSummary({
  ready,
  misspellings,
  fixableCount,
  onFixAll,
  onAccept,
  onIgnore,
}: {
  readonly ready: boolean;
  readonly misspellings: readonly Misspelling[];
  readonly fixableCount: number;
  readonly onFixAll: () => void;
  readonly onAccept: (misspelling: Misspelling, replacement: string) => void;
  readonly onIgnore: (word: string) => void;
}) {
  if (!ready || misspellings.length === 0) {
    return (
      <p className="rt-mono flex items-center gap-1.5 text-xs text-[var(--ink-4)]">
        <SpellCheck className="size-3.5" />
        {ready ? "No spelling issues" : "Checking spelling…"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-warm)] px-3 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="rt-mono flex items-center gap-1.5 text-sm text-[var(--terracotta-deep)] hover:underline"
          >
            <SpellCheck className="size-4" />
            {misspellings.length} possible spelling{" "}
            {misspellings.length === 1 ? "issue" : "issues"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-80 w-80 overflow-auto p-2"
        >
          <ul className="grid gap-1">
            {misspellings.map((misspelling) => (
              <li
                key={`${misspelling.start}:${misspelling.word}`}
                className="rounded-md px-2 py-1.5 hover:bg-[var(--paper-warm)]"
              >
                <SpellcheckSuggestionRow
                  misspelling={misspelling}
                  onAccept={onAccept}
                  onIgnore={onIgnore}
                />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={fixableCount === 0}
        onClick={onFixAll}
      >
        <Check /> Fix all
      </Button>
    </div>
  );
}

function SpellcheckSuggestionRow({
  misspelling,
  onAccept,
  onIgnore,
}: {
  readonly misspelling: Misspelling;
  readonly onAccept: (misspelling: Misspelling, replacement: string) => void;
  readonly onIgnore: (word: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="rt-mono text-xs text-[var(--ink-3)]">
        “{misspelling.word}”
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {misspelling.suggestions.length > 0 ? (
          misspelling.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAccept(misspelling, suggestion)}
              className="rt-body inline-flex items-center gap-1 rounded-md border border-[var(--line-strong)] bg-[var(--card)] px-2 py-0.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--terracotta)] hover:text-[var(--terracotta-deep)]"
            >
              <Check className="size-3" /> {suggestion}
            </button>
          ))
        ) : (
          <span className="rt-mono text-xs text-[var(--ink-4)]">
            No suggestion
          </span>
        )}
        <button
          type="button"
          onClick={() => onIgnore(misspelling.word)}
          className="rt-mono inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          <X className="size-3" /> Ignore
        </button>
      </div>
    </div>
  );
}

interface BackdropSegment {
  /** Source offset where this segment starts — a stable React key. */
  readonly offset: number;
  readonly text: string;
  readonly misspelling: Misspelling | null;
}

function buildSegments(
  value: string,
  misspellings: readonly Misspelling[],
): BackdropSegment[] {
  const segments: BackdropSegment[] = [];
  let cursor = 0;
  for (const misspelling of misspellings) {
    if (misspelling.start > cursor) {
      segments.push({
        offset: cursor,
        text: value.slice(cursor, misspelling.start),
        misspelling: null,
      });
    }
    segments.push({
      offset: misspelling.start,
      text: value.slice(misspelling.start, misspelling.end),
      misspelling,
    });
    cursor = misspelling.end;
  }
  segments.push({
    offset: cursor,
    text: value.slice(cursor),
    misspelling: null,
  });
  return segments;
}

function HighlightBackdrop({
  ref,
  value,
  misspellings,
  onAccept,
  onIgnore,
}: {
  readonly ref: React.Ref<HTMLDivElement>;
  readonly value: string;
  readonly misspellings: readonly Misspelling[];
  readonly onAccept: (misspelling: Misspelling, replacement: string) => void;
  readonly onIgnore: (word: string) => void;
}) {
  const segments = useMemo(
    () => buildSegments(value, misspellings),
    [value, misspellings],
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        SHARED_BOX,
        // Sits over the textarea; only marks capture pointer events so typing
        // and caret placement fall through to the transparent textarea beneath.
        "pointer-events-none absolute inset-0 z-10 select-none overflow-hidden whitespace-pre-wrap break-words border-transparent text-[var(--ink)]",
      )}
    >
      {segments.map((segment) =>
        segment.misspelling ? (
          <Popover key={segment.offset}>
            <PopoverTrigger asChild>
              <mark className="pointer-events-auto cursor-pointer rounded-[2px] bg-transparent text-[var(--ink)] underline decoration-[var(--terracotta)] decoration-wavy decoration-2 underline-offset-2">
                {segment.text}
              </mark>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <SpellcheckSuggestionRow
                misspelling={segment.misspelling}
                onAccept={onAccept}
                onIgnore={onIgnore}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Fragment key={segment.offset}>{segment.text}</Fragment>
        ),
      )}
      {/* Keeps the backdrop's final line height in step with the textarea when
          the text ends on a newline. */}
      {"\n"}
    </div>
  );
}
