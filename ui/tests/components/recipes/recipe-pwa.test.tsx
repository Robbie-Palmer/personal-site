import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function renderPwa() {
    return render(
      <QueryClientProvider client={createRecipeQueryClient()}>
        <RecipePwa />
      </QueryClientProvider>,
    );
  }

  it("explains that saved recipes remain readable while offline", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
    renderPwa();

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Offline. Saved recipes are read-only until you reconnect.",
    );
  });

  it("does not show the offline banner when requests still work", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    renderPwa();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/robots\.txt\?online-check=/),
        {
          cache: "no-store",
          credentials: "same-origin",
          method: "HEAD",
        },
      );
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
