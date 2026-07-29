import { render, waitFor } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeAnalyticsIdentity } from "@/components/recipes/recipe-analytics-identity";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("posthog-js", () => ({
  default: {
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

describe("RecipeAnalyticsIdentity", () => {
  beforeEach(() => {
    mocks.useSession.mockReset();
    vi.mocked(posthog.identify).mockReset();
    vi.mocked(posthog.reset).mockReset();
  });

  it("identifies a signed-in user without sending PII", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user-123",
          role: "user",
          name: "Test User",
          email: "private@example.test",
        },
      },
      isPending: false,
    });

    render(<RecipeAnalyticsIdentity />);

    await waitFor(() =>
      expect(posthog.identify).toHaveBeenCalledWith("user-123", {
        recipe_user_role: "user",
      }),
    );
    expect(posthog.identify).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: expect.anything() }),
    );
  });

  it("resets PostHog when the identified user signs out", async () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user-123", role: "user" } },
      isPending: false,
    });
    const view = render(<RecipeAnalyticsIdentity />);
    await waitFor(() => expect(posthog.identify).toHaveBeenCalledOnce());

    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    view.rerender(<RecipeAnalyticsIdentity />);

    await waitFor(() => expect(posthog.reset).toHaveBeenCalledOnce());
  });
});
