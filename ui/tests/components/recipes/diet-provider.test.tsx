import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DietProvider } from "@/components/recipes/diet-provider";

const apiMocks = vi.hoisted(() => ({
  getDietOptions: vi.fn(),
  getDietProfile: vi.fn(),
}));

vi.mock("@/lib/api/diet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/diet")>()),
  ...apiMocks,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "qa-user" } },
      isPending: false,
    }),
  },
}));

describe("DietProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces diet loading failures instead of silently disabling filters", async () => {
    apiMocks.getDietProfile.mockRejectedValue(new Error("offline"));
    apiMocks.getDietOptions.mockResolvedValue({
      presets: [],
      groups: [],
      ingredients: [],
    });

    render(
      <DietProvider>
        <p>Recipe content</p>
      </DietProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Diet preferences are unavailable/,
    );
    expect(screen.getByText("Recipe content")).toBeInTheDocument();
  });
});
