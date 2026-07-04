"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RecipeAvatar } from "@/components/recipes/recipe-avatar";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { PanelHead } from "./panel-head";

type SaveState = "idle" | "saving" | "saved" | "error";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-dashed border-[var(--line)] py-4 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="rt-body pt-1 text-[0.95rem] text-[var(--ink)] sm:w-36 sm:shrink-0">
        {label}
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {hint && <p className="rt-mono mt-1.5 text-[var(--ink-4)]">{hint}</p>}
      </div>
    </div>
  );
}

export function AccountPanel({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const [name, setName] = useState(user.name);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const savedName = useRef(user.name);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function save(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === savedName.current) return;
    setSaveState("saving");
    setErrorMsg(null);
    const result = await authClient.updateUser({ name: trimmed });
    if (result.error) {
      setSaveState("error");
      setErrorMsg(result.error.message ?? "Couldn't save your changes.");
      return;
    }
    savedName.current = trimmed;
    setSaveState("saved");
  }

  function onNameChange(value: string) {
    setName(value);
    setSaveState("idle");
    if (timer.current) clearTimeout(timer.current);
    // Save a moment after typing stops.
    timer.current = setTimeout(() => void save(value), 800);
  }

  return (
    <div>
      <PanelHead
        kicker="ACCOUNT"
        title="Who you are."
        sub="Your name and photo as they appear across your recipes."
      />

      <div className="flex items-center gap-4 border-b border-dashed border-[var(--line)] py-4">
        <RecipeAvatar
          name={name}
          email={user.email}
          image={user.image}
          size={64}
        />
        <p className="rt-mono text-[var(--ink-4)]">
          Your photo comes from your linked Google or GitHub account.
        </p>
      </div>

      <Field label="Display name">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onBlur={() => void save(name)}
          aria-label="Display name"
          className="max-w-sm bg-[var(--card)]"
        />
      </Field>

      <Field
        label="Email"
        hint="From your linked account — used to sign you in and find your recipes."
      >
        <span className="rt-mono text-[0.8125rem] normal-case tracking-normal text-[var(--ink)]">
          {user.email}
        </span>
      </Field>

      <div className="mt-4 flex items-center gap-2" aria-live="polite">
        {saveState === "saving" ? (
          <>
            <LoaderCircle className="size-3.5 animate-spin text-[var(--ink-3)]" />
            <span className="rt-mono text-[var(--ink-3)]">saving…</span>
          </>
        ) : saveState === "saved" ? (
          <>
            <Check className="size-3.5 text-[var(--sage)]" />
            <span className="rt-mono text-[var(--sage)]">saved</span>
          </>
        ) : saveState === "error" ? (
          <span role="alert" className="rt-mono text-[var(--destructive)]">
            {errorMsg}
          </span>
        ) : (
          <>
            <span className="size-2 rounded-full bg-[var(--sage)]" />
            <span className="rt-mono text-[var(--sage)]">
              changes save automatically
            </span>
          </>
        )}
      </div>
    </div>
  );
}
