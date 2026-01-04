import { ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TechnologyBadgeView } from "@/lib/domain/technology/technologyViews";
import { TechIcon } from "@/lib/tech-icons";

interface TechnologyCardProps {
  technology: TechnologyBadgeView;
  description?: string;
}

export function TechnologyCard({
  technology,
  description,
}: TechnologyCardProps) {
  const cardContent = (
    <Card className="transition-all hover:shadow-lg hover:border-primary/50 h-full group cursor-pointer">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {technology.hasIcon && (
              <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                <TechIcon name={technology.name} className="w-8 h-8" />
              </div>
            )}
            <CardTitle className="text-lg truncate">
              {technology.name}
            </CardTitle>
          </div>
          {technology.website && (
            <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
      </CardHeader>
      {description && (
        <CardContent className="pt-0">
          <CardDescription className="text-sm line-clamp-2">
            {description}
          </CardDescription>
        </CardContent>
      )}
    </Card>
  );

  if (technology.website) {
    return (
      <Link href={technology.website} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
