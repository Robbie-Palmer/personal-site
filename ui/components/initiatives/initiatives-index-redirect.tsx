"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const initiativesTab = "/projects?tab=initiatives";

export function InitiativesIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(initiativesTab);
  }, [router]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <p className="text-muted-foreground">
        Opening the{" "}
        <Link className="underline underline-offset-4" href={initiativesTab}>
          initiatives tab
        </Link>
        ...
      </p>
    </div>
  );
}
