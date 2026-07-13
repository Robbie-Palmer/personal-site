"use client";

import {
  Check,
  CircleX,
  Home,
  LoaderCircle,
  LogOut,
  MailPlus,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  acceptHouseholdInvitation,
  createHousehold,
  declineHouseholdInvitation,
  deleteHousehold,
  getHouseholdInvitations,
  getHouseholdMembers,
  getHouseholds,
  getIncomingHouseholdInvitations,
  type Household,
  type HouseholdInvitation,
  type HouseholdMember,
  type IncomingHouseholdInvitation,
  inviteHouseholdMember,
  leaveHousehold,
  removeHouseholdMember,
  renameHousehold,
  revokeHouseholdInvitation,
} from "@/lib/api/households";
import { PanelHead } from "./panel-head";

type Mutation =
  | "create"
  | "rename"
  | "invite"
  | "remove"
  | "revoke"
  | "leave"
  | "delete"
  | "accept"
  | "decline"
  | null;

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-dashed border-[var(--line)] py-6 first:pt-2 last:border-0">
      <p className="rt-mono text-[var(--terracotta)]">{title}</p>
      {sub && <p className="rt-body mt-1 text-sm text-[var(--ink-3)]">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HouseholdPanel({
  currentUser,
}: {
  currentUser: { id: string; email: string; name: string };
}) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [incoming, setIncoming] = useState<IncomingHouseholdInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<Mutation>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [households, nextIncoming] = await Promise.all([
        getHouseholds(signal),
        getIncomingHouseholdInvitations(signal),
      ]);
      setIncoming(nextIncoming);
      const next = households[0] ?? null;
      setHousehold(next);
      setName(next?.name ?? "");
      if (!next) {
        setMembers([]);
        setInvitations([]);
        return;
      }

      const [nextMembers, nextInvitations] = await Promise.all([
        getHouseholdMembers(next.id, signal),
        next.membership.role === "owner"
          ? getHouseholdInvitations(next.id, signal)
          : Promise.resolve([]),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Couldn't load your household.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function run(
    kind: Exclude<Mutation, null>,
    action: () => Promise<void>,
  ) {
    setMutation(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setMutation(null);
    }
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError("Give your household a name first.");
      return;
    }
    void run("create", async () => {
      await createHousehold(nextName);
      setNotice("Household created.");
      await load();
    });
  }

  function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!household) return;
    const nextName = name.trim();
    if (!nextName) {
      setError("Household name can't be empty.");
      return;
    }
    if (nextName === household.name) return;
    void run("rename", async () => {
      const updated = await renameHousehold(household.id, nextName);
      setHousehold({ ...household, ...updated });
      setName(updated.name);
      setNotice("Household name saved.");
    });
  }

  function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!household) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    void run("invite", async () => {
      const invitation = await inviteHouseholdMember(household.id, email);
      setInvitations((current) => [...current, invitation]);
      setInviteEmail("");
      setNotice(`Invitation created for ${invitation.email}.`);
    });
  }

  if (loading) {
    return (
      <div
        className="flex min-h-64 items-center justify-center"
        role="status"
        aria-label="Loading household"
      >
        <LoaderCircle className="size-6 animate-spin text-[var(--ink-3)]" />
      </div>
    );
  }

  if (!household) {
    return (
      <div>
        <PanelHead
          kicker="HOUSEHOLD"
          title="Cook better together."
          sub="Create one shared home for the people you plan, shop, and cook with. Your recipes stay personal unless you choose to share them."
        />

        {incoming.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--sage)]/60 bg-[var(--sage)]/10 p-5 sm:p-6">
            <p className="rt-mono text-[var(--terracotta)]">YOU'RE INVITED</p>
            <div className="mt-3 space-y-4">
              {incoming.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--line-strong)] bg-[var(--card)] p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="rt-display text-2xl">
                      Join {invitation.household.name}?
                    </h2>
                    <p className="rt-body mt-1 text-sm text-[var(--ink-2)]">
                      Share household recipes and the kitchen features as they
                      arrive. Expires {friendlyDate(invitation.expiresAt)}.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation === "decline"}
                      onClick={() =>
                        void run("decline", async () => {
                          await declineHouseholdInvitation(invitation.id);
                          setIncoming((current) =>
                            current.filter((item) => item.id !== invitation.id),
                          );
                          setNotice("Invitation declined.");
                        })
                      }
                    >
                      <CircleX /> Decline
                    </Button>
                    <Button
                      type="button"
                      disabled={mutation === "accept"}
                      onClick={() =>
                        void run("accept", async () => {
                          await acceptHouseholdInvitation(invitation.id);
                          setNotice(`Welcome to ${invitation.household.name}.`);
                          await load();
                        })
                      }
                      className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
                    >
                      {mutation === "accept" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                      Join household
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-[var(--line-strong)] bg-[var(--card)] p-5 sm:p-7">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--butter-soft)] text-[var(--terracotta-deep)]">
            <Home className="size-5" />
          </span>
          <h2 className="rt-display mt-4 text-3xl">Start a household.</h2>
          <p className="rt-body mt-2 max-w-xl text-[var(--ink-2)]">
            You can belong to one household for now. You'll be its owner and can
            invite or remove members.
          </p>
          <form
            onSubmit={onCreate}
            className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`${currentUser.name}'s kitchen`}
              aria-label="Household name"
              maxLength={120}
              disabled={mutation === "create"}
              className="bg-white"
            />
            <Button
              type="submit"
              disabled={mutation === "create"}
              className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
            >
              {mutation === "create" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Users />
              )}
              Create household
            </Button>
          </form>
        </div>
        {(error || notice) && (
          <p
            role={error ? "alert" : "status"}
            className={`rt-body mt-4 ${error ? "text-[var(--destructive)]" : "text-[var(--sage)]"}`}
          >
            {error ?? notice}
          </p>
        )}
      </div>
    );
  }

  const isOwner = household.membership.role === "owner";

  return (
    <div>
      <PanelHead
        kicker="HOUSEHOLD"
        title={household.name}
        sub={`${members.length} ${members.length === 1 ? "person" : "people"} · created ${friendlyDate(household.createdAt)} · you're ${isOwner ? "the owner" : "a member"}.`}
      />

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`rt-body mt-4 rounded-lg border px-3 py-2 text-sm ${
            error
              ? "border-[var(--destructive)]/30 bg-[var(--destructive)]/5 text-[var(--destructive)]"
              : "border-[var(--sage)]/40 bg-[var(--sage)]/10 text-[var(--ink-2)]"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      {isOwner && (
        <Section
          title="HOUSEHOLD NAME"
          sub="This is visible to everyone in the household."
        >
          <form
            onSubmit={onRename}
            className="flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              aria-label="Household name"
              disabled={mutation === "rename"}
              className="bg-[var(--card)]"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={mutation === "rename" || name.trim() === household.name}
            >
              {mutation === "rename" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check />
              )}
              Save name
            </Button>
          </form>
        </Section>
      )}

      <Section
        title="MEMBERS"
        sub="Members can see household-shared recipes and the shared kitchen features as they arrive."
      >
        <div className="divide-y divide-dashed divide-[var(--line)]">
          {members.map((member) => {
            const isCurrentUser = member.user.id === currentUser.id;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <RecipeAvatar
                  name={member.user.name}
                  email={member.user.email}
                  image={member.user.image}
                  size={42}
                />
                <div className="min-w-0 flex-1">
                  <p className="rt-body truncate font-semibold text-[var(--ink)]">
                    {member.user.name}
                    {isCurrentUser ? " · you" : ""}
                  </p>
                  <p className="rt-mono truncate text-[var(--ink-3)]">
                    {member.user.email}
                  </p>
                </div>
                <span className="rt-mono rounded-full border border-[var(--line-strong)] bg-[var(--paper-warm)] px-2 py-1 text-[var(--ink-2)]">
                  {member.role}
                </span>
                {isOwner && member.role !== "owner" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.user.name}`}
                    disabled={mutation === "remove"}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Remove ${member.user.name} from ${household.name}?`,
                        )
                      )
                        return;
                      void run("remove", async () => {
                        await removeHouseholdMember(household.id, member.id);
                        setMembers((current) =>
                          current.filter((item) => item.id !== member.id),
                        );
                        setNotice(`${member.user.name} was removed.`);
                      });
                    }}
                    className="text-[var(--terracotta-deep)] hover:text-[var(--terracotta-deep)]"
                  >
                    <UserMinus />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {isOwner && (
        <Section
          title="INVITE PEOPLE"
          sub="Invitations expire after 48 hours and only work for the invited email address."
        >
          <form
            onSubmit={onInvite}
            className="flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="cook@example.com"
              aria-label="Email to invite"
              disabled={mutation === "invite"}
              className="bg-[var(--card)]"
              required
            />
            <Button
              type="submit"
              disabled={mutation === "invite" || !inviteEmail.trim()}
              className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink-2)]"
            >
              {mutation === "invite" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <MailPlus />
              )}
              Invite
            </Button>
          </form>

          {invitations.length > 0 && (
            <div className="mt-5 max-w-lg rounded-xl border border-[var(--line)] bg-[var(--card)] px-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-3 border-b border-dashed border-[var(--line)] py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="rt-body truncate text-sm text-[var(--ink)]">
                      {invitation.email}
                    </p>
                    <p className="rt-mono text-[var(--ink-3)]">
                      pending · expires {friendlyDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Revoke invitation for ${invitation.email}`}
                    disabled={mutation === "revoke"}
                    onClick={() =>
                      void run("revoke", async () => {
                        await revokeHouseholdInvitation(
                          household.id,
                          invitation.id,
                        );
                        setInvitations((current) =>
                          current.filter((item) => item.id !== invitation.id),
                        );
                        setNotice(
                          `Invitation for ${invitation.email} revoked.`,
                        );
                      })
                    }
                    className="text-[var(--ink-3)]"
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section
        title="DANGER ZONE"
        sub={
          isOwner
            ? "Deleting a household removes its membership and invitations. Recipes return to private."
            : "Leaving makes your household-shared recipes private again."
        }
      >
        {isOwner ? (
          <Button
            type="button"
            variant="outline"
            disabled={mutation === "delete"}
            onClick={() => {
              if (
                !window.confirm(
                  `Delete ${household.name}? This can't be undone.`,
                )
              )
                return;
              void run("delete", async () => {
                await deleteHousehold(household.id);
                setHousehold(null);
                setMembers([]);
                setInvitations([]);
                setName("");
                setNotice(null);
              });
            }}
            className="border-[var(--destructive)]/50 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
          >
            {mutation === "delete" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            Delete household
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={mutation === "leave"}
            onClick={() => {
              if (!window.confirm(`Leave ${household.name}?`)) return;
              void run("leave", async () => {
                await leaveHousehold(household.id);
                setHousehold(null);
                setMembers([]);
                setName("");
              });
            }}
            className="border-[var(--destructive)]/50 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
          >
            {mutation === "leave" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <LogOut />
            )}
            Leave household
          </Button>
        )}
      </Section>
    </div>
  );
}
