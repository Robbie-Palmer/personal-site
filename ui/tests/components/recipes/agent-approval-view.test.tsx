import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  session: {
    data: {
      user: { id: "user-1", name: "Cook" },
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
          host_id: "host-1",
          agent_capability_grants: [
            { capability: "recipes.search", status: "pending" },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: "approved" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentApprovalView />);

    expect(await screen.findByText("Allow Meal planner?")).toBeInTheDocument();
    expect(screen.getByText("recipes.search")).toBeInTheDocument();
    expect(window.location.search).toBe("");

    await userEvent.click(
      screen.getByRole("button", { name: "Approve access" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/agent/approve-capability",
      expect.objectContaining({
        method: "POST",
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

  it("loads a notification link and accepts the code shown by the host", async () => {
    window.history.replaceState(
      null,
      "",
      "/recipes/settings/agents/approve?agent_id=agent-1",
    );
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          agent_id: "agent-1",
          name: "Meal planner",
          status: "pending",
          host_id: "host-1",
          agent_capability_grants: [
            { capability: "recipes.search", status: "pending" },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: "approved" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AgentApprovalView />);

    expect(await screen.findByText("Allow Meal planner?")).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve access" });
    expect(approve).toBeDisabled();

    await userEvent.type(
      screen.getByRole("textbox", { name: "Approval code" }),
      "WXYZ-9876",
    );
    await userEvent.click(approve);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/agent/approve-capability",
      expect.objectContaining({
        body: JSON.stringify({
          agent_id: "agent-1",
          user_code: "WXYZ-9876",
          action: "approve",
        }),
      }),
    );
  });
});
