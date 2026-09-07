import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
  },
}));

import { QueryClientProvider } from "@tanstack/react-query";
import { RecipePwa } from "@/components/recipes/recipe-pwa";
import { createRecipeQueryClient } from "@/lib/query/recipe-query-client";

describe("RecipePwa", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  function renderPwa() {
    return render(
      <QueryClientProvider client={createRecipeQueryClient()}>
        <RecipePwa />
      </QueryClientProvider>,
    );
  }

  it("explains that saved recipes remain readable while offline", () => {
    renderPwa();

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Offline. Saved recipes are read-only until you reconnect.",
    );
  });
});
