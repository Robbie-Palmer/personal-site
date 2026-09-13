import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { hasTechIcon, TechIcon } from "@/lib/api/tech-icons";
import type { ProjectWithADRsView } from "@/lib/domain/project/projectViews";

type PlatformSummaryProps = Pick<
  ProjectWithADRsView,
  "builtOn" | "platformTechnologies"
>;

export function PlatformSummary({
  builtOn = [],
  platformTechnologies = [],
}: Readonly<PlatformSummaryProps>) {
  if (builtOn.length === 0) return null;
  return (
    <section className="text-xs text-muted-foreground" aria-label="Platform">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span>Built on</span>
        {builtOn.map((layer, index) => (
          <span key={layer.slug}>
            <Link
              href={`/projects/personal-engineering-platform#layer-${layer.slug}`}
              className="text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
            >
              {layer.title}
            </Link>
            {index < builtOn.length - 1 ? "," : ""}
          </span>
        ))}
      </div>
      {platformTechnologies.length > 0 && (
        <details className="mt-1 w-fit">
          <summary className="cursor-pointer hover:text-foreground">
            {platformTechnologies.length} platform technologies
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {platformTechnologies.map((technology) => {
              const hasIcon = hasTechIcon(technology.name, technology.iconSlug);
              return (
                <Link
                  key={`${technology.slot}:${technology.slug}`}
                  href={`/technologies/${technology.slug}`}
                >
                  <Badge
                    variant="secondary"
                    interactive
                    className="h-6 gap-1 px-2 text-xs"
                  >
                    {hasIcon && (
                      <TechIcon
                        name={technology.name}
                        iconSlug={technology.iconSlug}
                        className="size-3"
                      />
                    )}
                    {technology.name}
                    <span className="sr-only">
                      {` from ${technology.layer}, ${technology.source}`}
                    </span>
                  </Badge>
                </Link>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
