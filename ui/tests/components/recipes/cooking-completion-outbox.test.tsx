import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookingCompletionOutbox } from "@/components/recipes/cooking-completion-outbox";

const mocks = vi.hoisted(() => ({
  flushCookingCompletionOutbox: vi.fn(),
  session: { user: { id: "cook-1" } } as {
    user: { id: string };
  } | null,
  isPending: false,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.isPending,
    }),
  },
}));

vi.mock("@/lib/api/cooking-insights", () => ({
  flushCookingCompletionOutbox: mocks.flushCookingCompletionOutbox,
}));

describe("CookingCompletionOutbox", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.session = { user: { id: "cook-1" } };
    mocks.isPending = false;
    mocks.flushCookingCompletionOutbox.mockReset().mockResolvedValue(undefined);
  });

  it("flushes for the authenticated user on mount and reconnect", async () => {
    render(<CookingCompletionOutbox />);
    await waitFor(() =>
      expect(mocks.flushCookingCompletionOutbox).toHaveBeenCalledWith("cook-1"),
    );

    act(() => globalThis.dispatchEvent(new Event("online")));
    await waitFor(() =>
      expect(mocks.flushCookingCompletionOutbox).toHaveBeenCalledTimes(2),
    );
  });

  it("does not flush before authentication resolves", () => {
    mocks.session = null;
    mocks.isPending = true;

    render(<CookingCompletionOutbox />);

    expect(mocks.flushCookingCompletionOutbox).not.toHaveBeenCalled();
  });

  it("retries transient failures with backoff", async () => {
    vi.useFakeTimers();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.flushCookingCompletionOutbox
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(undefined);

    render(<CookingCompletionOutbox />);
    await act(async () => Promise.resolve());
    expect(mocks.flushCookingCompletionOutbox).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mocks.flushCookingCompletionOutbox).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
