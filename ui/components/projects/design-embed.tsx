import { ExternalLink } from "lucide-react";

interface DesignEmbedProps {
  /** Path to the self-contained prototype HTML served from /public. */
  src: string;
  /** Short label shown above the frame. */
  title: string;
  /** Optional caption rendered beneath the title. */
  caption?: string;
  /** Frame height in pixels (the prototype scrolls internally). */
  height?: number;
}

/**
 * Embeds a self-contained interactive design prototype inline in MDX content.
 * Rendered as a sandboxed, lazy-loaded iframe with a header that links out to
 * the prototype full screen. Marked `not-prose` so the surrounding Tailwind
 * Typography styles don't bleed into the frame chrome.
 */
export function DesignEmbed({
  src,
  title,
  caption,
  height = 720,
}: DesignEmbedProps) {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-4 border-b bg-muted/50 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {caption && (
            <p className="truncate text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full screen
        </a>
      </div>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
        className="block w-full border-0 bg-background"
        style={{ height }}
      />
    </div>
  );
}
