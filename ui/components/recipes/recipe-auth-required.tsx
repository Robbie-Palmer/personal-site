import { LockKeyhole } from "lucide-react";
import { AuthButton } from "@/components/recipes/auth-button";

export function RecipeAuthRequired({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <div className="container mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 text-center">
      <div>
        <LockKeyhole className="mx-auto size-8 text-[var(--terracotta)]" />
        <h1 className="rt-display mt-4 text-5xl">{title}</h1>
        <p className="rt-body mt-3 text-[var(--ink-2)]">{description}</p>
        <AuthButton className="mt-6" />
      </div>
    </div>
  );
}
