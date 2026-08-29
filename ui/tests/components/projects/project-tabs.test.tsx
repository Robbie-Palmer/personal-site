import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectTabs } from "@/components/projects/project-tabs";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ProjectTabs", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("uses the canonical project URL when selecting the ADR tab", async () => {
    const user = userEvent.setup();
    render(
      <ProjectTabs
        projectSlug="recipe-site"
        adrCount={2}
        overview={<div>Overview content</div>}
        adrs={<div>ADR content</div>}
      />,
    );

    await user.click(
      screen.getByRole("tab", { name: /Architecture Decisions/ }),
    );

    expect(replaceMock).toHaveBeenCalledWith("/projects/recipe-site?tab=adrs", {
      scroll: false,
    });
  });
});
