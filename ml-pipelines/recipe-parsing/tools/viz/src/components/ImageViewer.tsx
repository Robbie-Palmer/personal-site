import { useState, useRef, useCallback, useEffect } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ImageViewerProps {
  sources: string[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.3;

export function ImageViewer({
  sources,
  initialIndex,
  onClose,
}: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const multi = sources.length > 1;
  const src = sources[index];

  const clampScale = (s: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // Reset zoom/pan when switching images
  function resetView() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  function goNext() {
    if (index < sources.length - 1) {
      setIndex(index + 1);
      resetView();
    }
  }

  function goPrev() {
    if (index > 0) {
      setIndex(index - 1);
      resetView();
    }
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((s) => clampScale(s + delta));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      didDrag.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [translate],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDrag.current = true;
      }
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    },
    [dragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDragging(false);
      // Click (not drag) on backdrop = close
      if (!didDrag.current) {
        const img = imageRef.current;
        if (img) {
          const rect = img.getBoundingClientRect();
          const inImage =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
          if (!inImage) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    },
    [onClose],
  );

  // Keyboard: Escape to close, arrows to navigate images
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft" && multi) {
        e.stopPropagation();
        setIndex((i) => {
          if (i > 0) {
            resetView();
            return i - 1;
          }
          return i;
        });
      } else if (e.key === "ArrowRight" && multi) {
        e.stopPropagation();
        setIndex((i) => {
          if (i < sources.length - 1) {
            resetView();
            return i + 1;
          }
          return i;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onClose, multi, sources.length]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80">
      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s + ZOOM_STEP))}
          className="p-2 bg-white/10 hover:bg-white/20 rounded text-white"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => clampScale(s - ZOOM_STEP))}
          className="p-2 bg-white/10 hover:bg-white/20 rounded text-white"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="p-2 bg-white/10 hover:bg-white/20 rounded text-white"
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <span className="text-white/60 text-xs tabular-nums px-2">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded text-white ml-2"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image counter */}
      {multi && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/60 text-sm tabular-nums">
          {index + 1} / {sources.length}
        </div>
      )}

      {/* Prev / Next buttons */}
      {multi && index > 0 && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {multi && index < sources.length - 1 && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image canvas — click on backdrop (not image) to close */}
      <div
        className="w-full h-full overflow-hidden select-none"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain pointer-events-none"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
