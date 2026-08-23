import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  session: {
    data: {
      user: { id: "user-1", name: "Cook", email: "cook@example.test" },
      session: { token: "session-1" },
    } as unknown,
    isPending: false,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => authMock.session },
}));

import { AgentApprovalView } from "@/components/recipes/settings/agent-approval-view";

describe("AgentApprovalView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    authMock.session.isPending = false;
    window.history.replaceState(
      null,
      "",
      "/recipes/settings/agents/approve?agent_id=agent-1&code=ABCD-1234",
    );
  });

  it("shows the requested capabilities and approves with the device code", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          agent_id: "agent-1",
          name: "Meal planner",
          status: "pending",
          mode: "delegated",
          host_id: "host-1",
          created_at: "2026-08-22T09:00:00.000Z",
          activated_at: null,
          last_used_at: null,
          expires_at: "2026-09-21T09:00:00.000Z",
          agent_capability_grants: [
            { capability: "recipes.search", status: "pending" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "host-1",
          name: "Kitchen helper host",
          status: "active",
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: "approved" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentApprovalView />);

    expect(await screen.findByText("Allow Meal planner?")).toBeInTheDocument();
    expect(screen.getByText("recipes.search")).toBeInTheDocument();
    expect(screen.getByText("Kitchen helper host")).toBeInTheDocument();
    expect(screen.getByText("cook@example.test")).toBeInTheDocument();
    expect(window.location.search).toBe("");

    await userEvent.click(
      screen.getByRole("button", { name: "Approve access" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/agent/approve-capability",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          agent_id: "agent-1",
          user_code: "ABCD-1234",
          action: "approve",
        }),
      }),
    );
    expect(
      await screen.findByText("Agent access approved."),
    ).toBeInTheDocument();
  });

  it("does not render an approval action for an incomplete link", async () => {
    window.history.replaceState(null, "", "/recipes/settings/agents/approve");

    render(<AgentApprovalView />);

    expect(
      await screen.findByText("This approval link is incomplete."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve access" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error when the agent response is malformed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));

    render(<AgentApprovalView />);

    expect(
      await screen.findByText("The agent request response was invalid."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve access" }),
    ).toBeDisabled();
  });
});
