import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import { ProjectsPageTabs } from "@/components/projects/projects-page-tabs";

describe("ProjectsPageTabs", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.search = "";
  });

  it("keeps initiatives in the projects tabs", () => {
    render(
      <ProjectsPageTabs
        initiatives={<div>Initiative list</div>}
        projects={<div>Project list</div>}
        philosophy={<div>Building philosophy</div>}
      />,
    );

    expect(screen.getByRole("tab", { name: "All Projects" })).toBeVisible();
    expect(
      screen.getByRole("tab", { name: "Building Philosophy" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Initiatives" })).toBeVisible();
  });

  it("shows initiatives by default", () => {
    render(
      <ProjectsPageTabs
        initiatives={<div>Initiative list</div>}
        projects={<div>Project list</div>}
        philosophy={<div>Building philosophy</div>}
      />,
    );

    expect(screen.getByRole("tab", { name: "Initiatives" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText("Initiative list")).toBeVisible();
  });

  it("renders initiatives when selected in the URL", () => {
    navigation.search = "tab=initiatives";

    render(
      <ProjectsPageTabs
        initiatives={<div>Initiative list</div>}
        projects={<div>Project list</div>}
        philosophy={<div>Building philosophy</div>}
      />,
    );

    expect(screen.getByText("Initiative list")).toBeVisible();
  });

  it("uses the query-free projects URL for the default tab", async () => {
    navigation.search = "tab=projects";
    const user = userEvent.setup();

    render(
      <ProjectsPageTabs
        initiatives={<div>Initiative list</div>}
        projects={<div>Project list</div>}
        philosophy={<div>Building philosophy</div>}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Initiatives" }));

    expect(navigation.replace).toHaveBeenCalledWith("/projects", {
      scroll: false,
    });
  });
});
