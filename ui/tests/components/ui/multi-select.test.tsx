import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MultiSelect } from "@/components/ui/multi-select";

describe("MultiSelect", () => {
  it("clears once when the clear button is activated from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiSelect
        options={[{ value: "one", label: "One" }]}
        value={["one"]}
        onChange={onChange}
      />,
    );

    const clearButton = screen.getByRole("button", {
      name: "Clear all selections",
    });
    clearButton.focus();
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
