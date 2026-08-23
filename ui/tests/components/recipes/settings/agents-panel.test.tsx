import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAgents: vi.fn(),
  revokeAgent: vi.fn(),
}));

vi.mock("@/lib/api/agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/agents")>()),
  listAgents: mocks.listAgents,
  revokeAgent: mocks.revokeAgent,
}));

import { AgentsPanel } from "@/components/recipes/settings/agents-panel";

const activeAgent = {
  id: "agent-1",
  name: "Meal planner",
  status: "active" as const,
  mode: "delegated" as const,
  hostId: "host-1",
  hostName: "Kitchen helper host",
  capabilityGrants: [
    { capability: "recipes.read", status: "active" },
    { capability: "cook_log.read", status: "active" },
  ],
  createdAt: "2026-08-22T09:00:00.000Z",
  lastUsedAt: "2026-08-22T10:00:00.000Z",
  expiresAt: "2026-09-21T09:00:00.000Z",
};

describe("AgentsPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAgents.mockResolvedValue([activeAgent]);
    mocks.revokeAgent.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows host, capabilities, status, use, and expiry", async () => {
    render(<AgentsPanel />);

    expect(await screen.findByText("Meal planner")).toBeInTheDocument();
    expect(
      screen.getByText("Hosted by Kitchen helper host"),
    ).toBeInTheDocument();
    expect(screen.getByText("recipes.read")).toBeInTheDocument();
    expect(screen.getByText("cook_log.read")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Last used")).toBeInTheDocument();
    expect(screen.getByText("Expires")).toBeInTheDocument();
  });

  it("revokes one agent and reloads the list", async () => {
    const user = userEvent.setup();
    mocks.listAgents
      .mockResolvedValueOnce([activeAgent])
      .mockResolvedValueOnce([{ ...activeAgent, status: "revoked" }]);
    render(<AgentsPanel />);

    await user.click(
      await screen.findByRole("button", { name: "Revoke access" }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Revoke Meal planner? Its access will stop immediately.",
    );
    expect(mocks.revokeAgent).toHaveBeenCalledWith("agent-1");
    await waitFor(() => expect(mocks.listAgents).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoke access" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the existing list visible when revocation fails", async () => {
    const user = userEvent.setup();
    mocks.revokeAgent.mockRejectedValue(new Error("Revocation unavailable"));
    render(<AgentsPanel />);

    await user.click(
      await screen.findByRole("button", { name: "Revoke access" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Revocation unavailable",
    );
    expect(screen.getByText("Meal planner")).toBeInTheDocument();
  });
});
