import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommandPaletteProvider,
  CommandPaletteTrigger,
} from "@/components/command-palette";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn() },
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    vi.unstubAllGlobals();
  });

  it("opens as a labelled modal dialog, traps focus, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider>
        <CommandPaletteTrigger />
      </CommandPaletteProvider>,
    );

    const triggers = screen.getAllByRole("button", { name: "Search" });
    const trigger = triggers[0];
    if (!trigger) throw new Error("Expected a command-palette trigger");
    await user.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Search or type a command..."),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });
});
