import { Lightbulb, Network } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllIdeas } from "@/lib/api/ideas";

export const metadata: Metadata = {
  title: "Ideas",
  description:
    "Laws, methods, and mental models that recur across my projects, decisions, and writing.",
  alternates: { canonical: "/ideas" },
};

export default function IdeasPage() {
  const ideas = getAllIdeas();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Lightbulb className="size-8 text-cyan-500" />
          <h1 className="text-4xl font-bold md:text-5xl">Ideas</h1>
        </div>
        <p className="text-xl leading-relaxed text-muted-foreground">
          Laws, methods, and mental models that recur across my projects,
          decisions, and writing. These pages are the stable definitions; the
          backlinks show where I have put each idea to work.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {ideas.map((idea) => (
          <Link key={idea.slug} href={`/ideas/${idea.slug}`} className="h-full">
            <Card className="h-full transition-all hover:border-primary/50 hover:shadow-lg">
              <CardHeader>
                <CardTitle>{idea.title}</CardTitle>
                <CardDescription className="leading-6">
                  {idea.description}
                </CardDescription>
                <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                  <Network className="size-3.5" />
                  {idea.referenceCount} published{" "}
                  {idea.referenceCount === 1 ? "reference" : "references"}
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
