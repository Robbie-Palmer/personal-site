import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <Card
      id={`tech-${technology.slug}`}
      className="transition-all hover:shadow-lg hover:border-primary/50 h-full group cursor-pointer aspect-square flex items-center justify-center p-3 scroll-mt-24"
    >
      <div className="flex flex-col items-center justify-center gap-2 w-full">
        {technology.hasIcon && (
          <div className="shrink-0 w-10 h-10 flex items-center justify-center">
            <TechIcon name={technology.name} className="w-10 h-10" />
          </div>
        )}
        <div className="text-center text-sm font-medium line-clamp-2 w-full px-1">
          {technology.name}
        </div>
      </div>
    </Card>
  );

  const wrappedCard = technology.website ? (
    <Link href={technology.website} target="_blank" rel="noopener noreferrer">
      {cardContent}
    </Link>
  ) : (
    cardContent
  );

  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{wrappedCard}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return wrappedCard;
}
