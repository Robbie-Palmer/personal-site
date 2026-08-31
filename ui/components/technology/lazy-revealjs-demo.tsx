"use client";

import dynamic from "next/dynamic";

const RevealJsDemo = dynamic(
  () =>
    import("@/components/technology/revealjs-demo").then(
      (module) => module.RevealJsDemo,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex aspect-video items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground"
        role="status"
      >
        Loading presentation...
      </div>
    ),
  },
);

export function LazyRevealJsDemo({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RevealJsDemo>{children}</RevealJsDemo>;
}
