import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CookLogPage, { metadata } from "@/app/recipes/log/page";

vi.mock("@/components/recipes/cooking-log", () => ({
  CookingLog: () => <div>Cooking log content</div>,
}));

describe("cook log page", () => {
  it("renders the cooking log with private-page metadata", () => {
    render(<CookLogPage />);

    expect(screen.getByText("Cooking log content")).toBeInTheDocument();
    expect(metadata).toMatchObject({
      title: "Cook Log",
      robots: { index: false, follow: false },
    });
  });
});
