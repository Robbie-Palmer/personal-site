import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DietProvider, useDiet } from "@/components/recipes/diet-provider";
import { render, screen } from "@/tests/test-utils";

const apiMocks = vi.hoisted(() => ({
  getDietOptions: vi.fn(),
  getDietProfile: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/diet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/diet")>()),
  ...apiMocks,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: authMocks.useSession,
  },
}));

describe("DietProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    authMocks.useSession.mockReturnValue({
      data: { user: { id: "qa-user" } },
      isPending: false,
    });
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

  it("fails fast when the hook is used outside its provider", () => {
    function UnwrappedConsumer() {
      useDiet();
      return null;
    }

    expect(() => render(<UnwrappedConsumer />)).toThrow(
      "useDiet must be used within a DietProvider.",
    );
  });

  it("reports loading immediately for a newly authenticated user", async () => {
    let resolveProfile!: (value: {
      presetDietKeys: string[];
      excludedIngredientSlugs: string[];
      excludedGroupKeys: string[];
      recipeMatchMode: "hide";
    }) => void;
    apiMocks.getDietProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    apiMocks.getDietOptions.mockResolvedValue({
      presets: [],
      groups: [],
      ingredients: [],
    });

    function LoadingProbe() {
      const { loading } = useDiet();
      return <p>{loading ? "Diet loading" : "Diet ready"}</p>;
    }

    render(
      <DietProvider>
        <LoadingProbe />
      </DietProvider>,
    );

    expect(screen.getByText("Diet loading")).toBeInTheDocument();

    resolveProfile({
      presetDietKeys: [],
      excludedIngredientSlugs: [],
      excludedGroupKeys: [],
      recipeMatchMode: "hide",
    });

    expect(await screen.findByText("Diet ready")).toBeInTheDocument();
  });
});
