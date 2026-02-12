"use client";

import Link from "next/link";
import posthog from "posthog-js";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Section {
  title: string;
  description: string;
  href: string;
}

interface NotFoundLinksProps {
  sections: Section[];
}

export function NotFoundLinks({ sections }: NotFoundLinksProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          onClick={() =>
            posthog.capture("not_found_recovery_clicked", {
              destination: section.href,
              destination_title: section.title,
            })
          }
        >
          <Card className="h-full hover:border-primary transition-colors p-2">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
