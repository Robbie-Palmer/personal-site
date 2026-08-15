import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PantryRealtimeBoundary } from "@/components/recipes/pantry-realtime-boundary";
import type { Pantry } from "@/lib/api/pantry";
import { pantryQuery } from "@/lib/query/pantry-queries";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

const authMocks = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user-1" } },
    isPending: false,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => authMocks.session,
  },
}));

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;

  constructor(url: string | URL) {
    super();
    this.url = url.toString();
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  receive(value: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(value) }),
    );
  }
}

const pantry = (revision: string): Pantry => ({
  resourceId: "household-1",
  revision,
  scope: {
    type: "household",
    household: { id: "household-1", name: "Home" },
  },
  stock: revision === "1" ? { onion: "fresh" } : { onion: "cupboards" },
  itemVersions: { onion: revision },
});

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PantryRealtimeBoundary", () => {
  it("refetches an active household pantry for a newer revision", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryFn = vi
      .fn<() => Promise<Pantry>>()
      .mockResolvedValueOnce(pantry("1"))
      .mockResolvedValue(pantry("2"));

    function PantryObserver() {
      useQuery({
        ...pantryQuery("user-1"),
        queryFn,
        refetchInterval: false,
      });
      return null;
    }

    const view = render(
      <QueryClientProvider client={queryClient}>
        <PantryRealtimeBoundary />
        <PantryObserver />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryData<Pantry>(recipeQueryKeys.pantry("user-1"))
          ?.revision,
      ).toBe("1");
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
    const realtime = FakeWebSocket.instances[0];
    if (!realtime) throw new Error("Expected realtime socket");
    realtime.receive({
      type: "resource.changed",
      resourceType: "pantry",
      resourceId: "household-1",
      revision: "2",
      operationId: "operation-2",
      changeKind: "pantry.item-set",
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<Pantry>(recipeQueryKeys.pantry("user-1"))
          ?.revision,
      ).toBe("2");
    });
    expect(queryFn).toHaveBeenCalledTimes(2);

    realtime.receive({
      type: "resource.changed",
      resourceType: "pantry",
      resourceId: "household-1",
      revision: "1",
      operationId: "operation-1",
      changeKind: "pantry.item-set",
    });
    await Promise.resolve();
    expect(queryFn).toHaveBeenCalledTimes(2);
    view.unmount();
  });
});
