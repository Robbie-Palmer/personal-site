import { render, screen } from "@testing-library/react";
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
});
