import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TechOrbit } from "@/components/ui/tech-icon-orbit";

vi.mock("@/lib/api/tech-icons", () => ({
  getTechIconUrl: () => "/tech-icons/typescript.svg",
}));

const technologies = [{ name: "TypeScript" }, { name: "Python" }];

let resize: ResizeObserverCallback;
let frames: FrameRequestCallback[];
const disconnect = vi.fn();

function measure(width: number) {
  act(() => {
    resize(
      [{ contentRect: { width } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  });
}

function runFrames() {
  const pending = frames;
  frames = [];
  act(() => {
    for (const frame of pending) frame(performance.now());
  });
}

function orbitHeight(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[style*='height']")?.style
    .height;
}

describe("TechOrbit", () => {
  beforeEach(() => {
    frames = [];
    disconnect.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {
          disconnect();
        }
      },
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) =>
      frames.push(frame),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers the measured width so the observer never resizes what it just measured", () => {
    const { container } = render(<TechOrbit technologies={technologies} />);
    const initialHeight = orbitHeight(container);

    measure(160);

    // Writing state inside the callback is what makes browsers report
    // "ResizeObserver loop completed with undelivered notifications".
    expect(orbitHeight(container)).toBe(initialHeight);
    expect(frames).toHaveLength(1);

    runFrames();

    expect(orbitHeight(container)).not.toBe(initialHeight);
  });

  it("ignores sub-pixel width changes", () => {
    const { container } = render(<TechOrbit technologies={technologies} />);

    measure(160);
    runFrames();
    const settledHeight = orbitHeight(container);

    measure(160.4);
    runFrames();

    expect(orbitHeight(container)).toBe(settledHeight);
  });

  it("stops observing when unmounted", () => {
    const { unmount } = render(<TechOrbit technologies={technologies} />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
