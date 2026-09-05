import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { InitiativesIndexRedirect } from "@/components/initiatives/initiatives-index-redirect";

describe("InitiativesIndexRedirect", () => {
  it("redirects the old index to the projects tab", async () => {
    render(<InitiativesIndexRedirect />);

    expect(
      screen.getByRole("link", { name: "initiatives tab" }),
    ).toHaveAttribute("href", "/projects?tab=initiatives");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/projects?tab=initiatives"),
    );
  });
});
