import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InitiativesIndexRedirect } from "@/components/initiatives/initiatives-index-redirect";

describe("InitiativesIndexRedirect", () => {
  it("redirects the old index without requiring JavaScript", () => {
    render(<InitiativesIndexRedirect />);

    expect(
      screen.getByRole("link", { name: "initiatives tab" }),
    ).toHaveAttribute("href", "/projects?tab=initiatives");
    expect(
      document.querySelector('meta[http-equiv="refresh"]'),
    ).toHaveAttribute("content", "0;url=/projects?tab=initiatives");
  });
});
