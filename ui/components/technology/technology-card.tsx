import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TechnologyBadgeView } from "@/lib/domain/technology/technologyViews";
import { getTechIconUrl } from "@/lib/tech-icons";

interface TechnologyCardProps {
  technology: TechnologyBadgeView;
  description?: string;
}

export function TechnologyCard({
  technology,
  description,
}: TechnologyCardProps) {
  const iconUrl = getTechIconUrl(technology.name, technology.iconSlug);

  const cardContent = (
    <Card
      id={`tech-${technology.slug}`}
      className="transition-all hover:shadow-lg hover:border-primary/50 h-full group aspect-square flex items-center justify-center p-3 scroll-mt-24 relative"
    >
      <ExternalLink className="absolute top-2 right-2 w-3 h-3 text-muted-foreground opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
      <div className="flex flex-col items-center justify-center gap-2 w-full">
        {iconUrl && (
          <div className="shrink-0 w-10 h-10 flex items-center justify-center relative">
            <Image
              src={iconUrl}
              alt={technology.name}
              width={40}
              height={40}
              className="object-contain brightness-0 dark:invert"
            />
          </div>
        )}
        <div className="text-center text-sm font-medium line-clamp-2 w-full px-1">
          {technology.name}
        </div>
      </div>
    </Card>
  );

  const wrappedCard = (
    <Link href={technology.website} target="_blank" rel="noopener noreferrer">
      {cardContent}
    </Link>
  );

  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{wrappedCard}</TooltipTrigger>
          <TooltipContent>
            <p className="text-sm leading-relaxed text-center whitespace-nowrap">
              {description}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return wrappedCard;
}
