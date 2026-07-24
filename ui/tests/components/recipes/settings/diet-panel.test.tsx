import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DietPanel } from "@/components/recipes/settings/diet-panel";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";
import { fireEvent, render, screen } from "@/tests/test-utils";

const apiMocks = vi.hoisted(() => ({
  getDietOptions: vi.fn(),
  getDietProfile: vi.fn(),
  saveDietProfile: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "diet-user" } },
      isPending: false,
    }),
  },
}));

vi.mock("@/lib/api/diet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/diet")>()),
  ...apiMocks,
}));

describe("DietPanel", () => {
  beforeEach(() => {
    apiMocks.getDietProfile.mockResolvedValue({
      presetDietKeys: ["vegan"],
      excludedIngredientSlugs: [],
      excludedGroupKeys: [],
      recipeMatchMode: "hide",
    });
    apiMocks.getDietOptions.mockResolvedValue({
      presets: [
        {
          key: "vegan",
          label: "Vegan",
          sub: "No animal products",
          excludedGroupKeys: ["meat", "dairy"],
          excludedIngredientSlugs: [],
        },
      ],
      groups: [
        {
          key: "meat",
          label: "Meat",
          sub: "Meat ingredients",
          ingredientSlugs: ["bacon"],
        },
        {
          key: "chilli",
          label: "Chilli",
          sub: "Chilli ingredients",
          ingredientSlugs: ["chilli"],
        },
      ],
      ingredients: [{ slug: "bacon", name: "Bacon", category: "protein" }],
    });
    apiMocks.saveDietProfile.mockImplementation(async (profile) => profile);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("checks groups covered by a selected preset without adding custom state", async () => {
    render(<DietPanel />);

    const meat = await screen.findByRole("button", { name: /Meat/ });
    const chilli = screen.getByRole("button", { name: /Chilli/ });

    expect(meat).toHaveAttribute("aria-pressed", "true");
    expect(meat).toBeDisabled();
    expect(meat).toHaveTextContent("covered by preset");
    expect(chilli).toHaveAttribute("aria-pressed", "false");
    expect(chilli).not.toBeDisabled();
  });

  it("updates the shared diet cache after a successful save", async () => {
    const { queryClient } = render(<DietPanel />);
    const chilli = await screen.findByRole("button", { name: /Chilli/ });

    fireEvent.click(chilli);
    fireEvent.click(screen.getByRole("button", { name: "Save diet profile" }));

    expect(await screen.findByText("saved")).toBeInTheDocument();
    expect(
      queryClient.getQueryData(recipeQueryKeys.dietProfile("diet-user")),
    ).toEqual(
      expect.objectContaining({
        excludedGroupKeys: ["chilli"],
      }),
    );
  });

  it("clears the delayed picker close when unmounted", async () => {
    const { unmount } = render(<DietPanel />);
    const input = await screen.findByLabelText(
      "Search canonical ingredients to exclude",
    );
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    fireEvent.focus(input);
    fireEvent.blur(input);
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
