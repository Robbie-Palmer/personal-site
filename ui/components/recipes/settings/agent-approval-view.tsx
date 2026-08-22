"use client";

import { Bot, Check, LoaderCircle, Lock, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type CapabilityGrant = {
  capability: string;
  description?: string;
  status: string;
};

type AgentRequest = {
  agent_id: string;
  name: string;
  status: string;
  host_id: string;
  agent_capability_grants: CapabilityGrant[];
};

type ApprovalIntent = {
  agentId: string;
  code: string;
};

function isAgentRequest(value: unknown): value is AgentRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentRequest>;
  return (
    typeof candidate.agent_id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.host_id === "string" &&
    Array.isArray(candidate.agent_capability_grants) &&
    candidate.agent_capability_grants.every(
      (grant) =>
        grant !== null &&
        typeof grant === "object" &&
        typeof grant.capability === "string" &&
        typeof grant.status === "string" &&
        (grant.description === undefined ||
          typeof grant.description === "string"),
    )
  );
}

function readApprovalIntent(): ApprovalIntent | null {
  const params = new URLSearchParams(globalThis.location.search);
  const agentId = params.get("agent_id")?.trim();
  const code = params.get("code")?.trim();
  if (!agentId || !code) return null;

  globalThis.history.replaceState(null, "", globalThis.location.pathname);
  return { agentId, code };
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;
  return body?.message ?? body?.error ?? "The request could not be completed.";
}

export function AgentApprovalView() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [intent, setIntent] = useState<ApprovalIntent | null | undefined>();
  const [agent, setAgent] = useState<AgentRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "deny" | null>(
    null,
  );
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIntent(readApprovalIntent());
  }, []);

  useEffect(() => {
    if (!session || !intent) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch(
      `/api/auth/agent/get?agent_id=${encodeURIComponent(intent.agentId)}`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        const body: unknown = await response.json();
        if (!isAgentRequest(body)) {
          throw new Error("The agent request response was invalid.");
        }
        setAgent(body);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The agent request could not be loaded.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [intent, session]);

  async function decide(action: "approve" | "deny") {
    if (!intent) return;
    setPendingAction(action);
    setError(null);
    try {
      const response = await fetch("/api/auth/agent/approve-capability", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_id: intent.agentId,
          user_code: intent.code,
          action,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setResult(action === "approve" ? "approved" : "denied");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The approval decision could not be saved.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (sessionPending || intent === undefined || loading) {
    return (
      <output
        aria-label="Loading agent access request"
        className="container mx-auto flex max-w-xl items-center justify-center px-4 py-24"
      >
        <LoaderCircle className="size-6 animate-spin text-[var(--ink-3)]" />
      </output>
    );
  }

  if (!session) {
    return (
      <ApprovalCard
        icon={<Lock className="size-5" />}
        title="Log in to review this request."
      >
        <p className="rt-body text-[var(--ink-2)]">
          Use the account menu above, then reopen the approval link from your
          agent host.
        </p>
      </ApprovalCard>
    );
  }

  if (!intent) {
    return (
      <ApprovalCard
        icon={<X className="size-5" />}
        title="This approval link is incomplete."
      >
        <p className="rt-body text-[var(--ink-2)]">
          Start the connection again from the agent host to get a fresh link.
        </p>
      </ApprovalCard>
    );
  }

  if (result) {
    return (
      <ApprovalCard
        icon={<Check className="size-5" />}
        title={`Agent access ${result}.`}
      >
        <p className="rt-body text-[var(--ink-2)]">
          You can close this page and return to the agent host.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/recipes">Back to recipes</Link>
        </Button>
      </ApprovalCard>
    );
  }

  return (
    <ApprovalCard
      icon={<Bot className="size-5" />}
      title={agent ? `Allow ${agent.name}?` : "Review agent access"}
    >
      <p className="rt-body text-[var(--ink-2)]">
        This agent will act as you, but only for the capabilities listed below.
        It will not receive your browser session.
      </p>

      {agent && (
        <div className="mt-5 rounded-xl border border-[var(--line-strong)] bg-[var(--paper-warm)] p-4">
          <p className="rt-mono text-[var(--ink-3)]">Requested access</p>
          <ul className="mt-3 space-y-3">
            {agent.agent_capability_grants
              .filter((grant) => grant.status === "pending")
              .map((grant) => (
                <li key={grant.capability}>
                  <p className="rt-mono text-[var(--ink)]">
                    {grant.capability}
                  </p>
                  {grant.description && (
                    <p className="rt-body mt-0.5 text-sm text-[var(--ink-2)]">
                      {grant.description}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          <p className="rt-mono mt-4 text-xs text-[var(--ink-3)]">
            Host {agent.host_id}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rt-body mt-4 text-[var(--destructive)]">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void decide("approve")}
          disabled={!agent || pendingAction !== null}
          className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
        >
          {pendingAction === "approve" && (
            <LoaderCircle className="size-4 animate-spin" />
          )}
          Approve access
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void decide("deny")}
          disabled={pendingAction !== null}
        >
          {pendingAction === "deny" && (
            <LoaderCircle className="size-4 animate-spin" />
          )}
          Deny
        </Button>
      </div>
    </ApprovalCard>
  );
}

function ApprovalCard({
  children,
  icon,
  title,
}: Readonly<{
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}>) {
  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--card)] p-6 sm:p-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper-warm)] text-[var(--terracotta)]">
          {icon}
        </span>
        <p className="rt-mono text-[var(--terracotta)]">Agent access</p>
        <h1 className="rt-display mt-1 text-4xl">{title}</h1>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
