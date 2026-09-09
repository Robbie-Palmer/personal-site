import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { IdeaLinkView } from "@/lib/domain/idea";

export function IdeaBadges({ ideas }: Readonly<{ ideas: IdeaLinkView[] }>) {
  if (ideas.length === 0) return null;

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Related ideas">
      {ideas.map((idea) => (
        <Badge key={idea.slug} variant="outline" asChild>
          <Link href={`/ideas/${idea.slug}`} className="gap-1.5">
            <Lightbulb className="size-3" />
            {idea.title}
          </Link>
        </Badge>
      ))}
    </nav>
  );
}
