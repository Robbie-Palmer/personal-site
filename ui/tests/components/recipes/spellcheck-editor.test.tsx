import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/tests/test-utils";

const mocks = vi.hoisted(() => ({
  dictionary: new Map<string, string[]>([
    ["teh", ["the"]],
    ["tomatoe", ["tomato"]],
  ]),
  ready: true,
}));

vi.mock("@/hooks/use-typo-dictionary", () => ({
  useTypoDictionary: () => ({
    dictionary: mocks.dictionary,
    ready: mocks.ready,
  }),
}));

import { SpellcheckEditor } from "@/components/recipes/spellcheck-editor";

function ControlledEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SpellcheckEditor
        value={value}
        onChange={setValue}
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
    const marks = container.querySelectorAll("mark");
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

  it("fixes every issue at once", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh @tomatoe{}" />);

    await user.click(screen.getByRole("button", { name: /fix all/i }));

    expect(screen.getByTestId("value")).toHaveTextContent("the @tomato{}");
  });

  it("stops flagging a word once ignored", async () => {
    const user = userEvent.setup();
    render(<ControlledEditor initial="teh onion" />);

    await user.click(screen.getByText("1 possible spelling issue"));
    const popover = await screen.findByRole("list");
    await user.click(within(popover).getByRole("button", { name: /ignore/i }));

    expect(screen.getByText("No spelling issues")).toBeInTheDocument();
  });
});
