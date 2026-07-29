import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/tests/test-utils";

const mocks = vi.hoisted(() => ({
  dictionary: null as Map<string, string[]> | null,
  ready: true,
  retry: vi.fn(),
}));

vi.mock("@/hooks/use-typo-dictionary", () => ({
  useTypoDictionary: () => ({
    dictionary: mocks.dictionary,
    ready: mocks.ready,
    retry: mocks.retry,
  }),
}));

import { SpellcheckEditor } from "@/components/recipes/spellcheck-editor";

beforeEach(() => {
  mocks.dictionary = new Map<string, string[]>([
    ["teh", ["the"]],
    ["tomatoe", ["tomato"]],
    ["cofee", ["coffee"]],
  ]);
  mocks.ready = true;
  mocks.retry = vi.fn();
});

function ControlledEditor({
  initial,
  maxLength,
}: {
  initial: string;
  maxLength?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SpellcheckEditor
        value={value}
        onChange={setValue}
        maxLength={maxLength}
        ariaLabel="Recipe text"
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("SpellcheckEditor", () => {
  it("summarises the number of issues and underlines each in the backdrop", () => {
    const { container } = render(<ControlledEditor initial="teh @tomatoe{}" />);

    expect(screen.getByText("2 possible spelling issues")).toBeInTheDocument();
    const marks = container.querySelectorAll("[data-spellcheck-mark]");
    expect([...marks].map((mark) => mark.textContent)).toEqual([
      "teh",
      "tomatoe",
    ]);
  });

  it("accepts a suggestion from the issues list, rewriting the source", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh onion" />);

    await user.click(screen.getByText("1 possible spelling issue"));
    const popover = await screen.findByRole("list");
    await user.click(within(popover).getByRole("button", { name: /the/ }));

    expect(screen.getByTestId("value")).toHaveTextContent("the onion");
  });

  it("accepts a correction by clicking the highlighted word", async () => {
    const user = userEvent.setup();
    const { container } = render(<ControlledEditor initial="teh onion" />);

    const mark = container.querySelector("[data-spellcheck-mark]");
    expect(mark).not.toBeNull();
    await user.click(mark as HTMLElement);
    await user.click(await screen.findByRole("button", { name: "the" }));

    expect(screen.getByTestId("value")).toHaveTextContent("the onion");
  });

  it("fixes every issue at once", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh @tomatoe{}" />);

    await user.click(screen.getByRole("button", { name: /fix all/i }));

    expect(screen.getByTestId("value")).toHaveTextContent("the @tomato{}");
  });

  it("does not apply a correction that would exceed maxLength", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="cofee" maxLength={5} />);

    await user.click(screen.getByText("1 possible spelling issue"));
    const popover = await screen.findByRole("list");
    await user.click(within(popover).getByRole("button", { name: "coffee" }));

    // "coffee" (6) exceeds the 5-char limit, so the source is left unchanged.
    expect(screen.getByTestId("value")).toHaveTextContent("cofee");
  });

  it("stops flagging a word once ignored", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh onion" />);

    await user.click(screen.getByText("1 possible spelling issue"));
    const popover = await screen.findByRole("list");
    await user.click(within(popover).getByRole("button", { name: /ignore/i }));

    expect(screen.getByText("No spelling issues")).toBeInTheDocument();
  });

  it("offers a retry when the dictionary is unavailable", async () => {
    mocks.dictionary = null;
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh onion" />);

    expect(screen.getByText("Spell-check unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });
});
