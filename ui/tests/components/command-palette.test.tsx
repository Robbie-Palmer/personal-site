import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommandPaletteProvider,
  CommandPaletteTrigger,
  type FilterOption,
  HotkeyHint,
  useCommandPalette,
  useRegisterFilters,
} from "@/components/command-palette-shell";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const { captureMock } = vi.hoisted(() => ({ captureMock: vi.fn() }));
const originalScrollIntoView = Element.prototype.scrollIntoView;

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("posthog-js", () => ({
  default: { capture: captureMock },
}));

const projectFilter: FilterOption = {
  value: "active",
  label: "Active projects",
  group: "Status",
  paramName: "status",
};

function RegisteredFilter() {
  useRegisterFilters([projectFilter]);
  return null;
}

function PaletteState() {
  const { open } = useCommandPalette();
  return <output>{open ? "open" : "closed"}</output>;
}

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    captureMock.mockReset();
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

    const dialog = await screen.findByRole("dialog", {
      name: "Command palette",
    });
    expect(dialog).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Search or type a command..."),
      ).toHaveFocus(),
    );

    await user.tab();
    expect(dialog).toContainElement(
      document.activeElement as HTMLElement | null,
    );
    await user.tab({ shift: true });
    expect(dialog).toContainElement(
      document.activeElement as HTMLElement | null,
    );

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).not.toBeInTheDocument();
  });

  it("focuses the dialog without opening the search input on touch devices", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider>
        <CommandPaletteTrigger />
      </CommandPaletteProvider>,
    );

    const trigger = screen.getAllByRole("button", { name: "Search" })[0];
    if (!trigger) throw new Error("Expected a command-palette trigger");
    await user.click(trigger);

    expect(
      await screen.findByRole("dialog", { name: "Command palette" }),
    ).toHaveFocus();
    expect(
      screen.getByPlaceholderText("Search or type a command..."),
    ).not.toHaveFocus();
  });

  it("toggles from the keyboard and records only the opening action", async () => {
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider>
        <PaletteState />
      </CommandPaletteProvider>,
    );

    expect(screen.getByText("closed")).toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByText("open")).toBeInTheDocument();
    expect(captureMock).toHaveBeenCalledWith("command_palette_opened", {
      trigger: "keyboard",
    });

    await user.keyboard("{Control>}k{/Control}");
    expect(await screen.findByText("closed")).toBeInTheDocument();
    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("registers page filters and removes them when the page unmounts", async () => {
    const { rerender } = render(
      <CommandPaletteProvider>
        <RegisteredFilter />
        <CommandPaletteTrigger />
      </CommandPaletteProvider>,
    );

    const firstTrigger = screen.getAllByRole("button", { name: "Search" })[0];
    if (!firstTrigger) throw new Error("Expected a command-palette trigger");
    await userEvent.click(firstTrigger);
    expect(await screen.findByText("Active projects")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    rerender(
      <CommandPaletteProvider>
        <CommandPaletteTrigger />
      </CommandPaletteProvider>,
    );
    const secondTrigger = screen.getAllByRole("button", { name: "Search" })[0];
    if (!secondTrigger) throw new Error("Expected a command-palette trigger");
    await userEvent.click(secondTrigger);
    expect(screen.queryByText("Active projects")).not.toBeInTheDocument();
  });

  it("rejects hooks outside the provider", () => {
    expect(() => render(<PaletteState />)).toThrow(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  });

  it("shows the platform-specific hotkey", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh)",
    );
    const { unmount } = render(<HotkeyHint />);
    expect(await screen.findByText("⌘")).toBeInTheDocument();
    unmount();

    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (X11; Linux x86_64)",
    );
    render(<HotkeyHint />);
    expect(await screen.findByText("Ctrl")).toBeInTheDocument();
  });
});
