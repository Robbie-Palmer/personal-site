import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CesiumDemo } from "@/components/technology/cesium/cesium-demo";

const canvasState = vi.hoisted(() => ({
  selectedPointId: null as string | null,
}));

vi.mock("@/components/technology/cesium/lazy-cesium-demo-canvas", () => ({
  LazyCesiumDemoCanvas: ({
    selectedPointId,
  }: {
    selectedPointId: string | null;
  }) => {
    canvasState.selectedPointId = selectedPointId;
    return <div>Cesium canvas</div>;
  },
}));

describe("CesiumDemo", () => {
  afterEach(() => {
    canvasState.selectedPointId = null;
    vi.restoreAllMocks();
  });

  it("selects camera targets while retaining an accessible coordinate table", async () => {
    const user = userEvent.setup();
    render(<CesiumDemo />);

    expect(screen.getByText("Cesium canvas")).toBeVisible();
    expect(screen.getByRole("button", { name: "Global" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("cell", { name: "Belfast" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Singapore" }));

    expect(canvasState.selectedPointId).toBe("singapore");
    expect(screen.getByRole("button", { name: "Singapore" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reports snapped camera movement for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    });

    render(<CesiumDemo />);

    expect(screen.getByText(/camera transitions snap/i)).toBeVisible();
  });
});
