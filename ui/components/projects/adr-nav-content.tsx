"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getADRStatusBadgeClasses } from "@/lib/adr-styles";
import type { Project } from "@/lib/projects";
import { cn } from "@/lib/styles";

interface ADRNavContentProps {
  project: Project;
  className?: string;
  onLinkClick?: () => void;
}

export function ADRNavContent({
  project,
  className,
  onLinkClick,
}: ADRNavContentProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-col gap-2 pb-4 shrink-0">
        <h3 className="font-semibold text-lg px-2">Decisions</h3>
        <p className="text-sm text-muted-foreground px-2">
          {project.adrs.length} records found
        </p>
        <Separator className="mt-2" />
      </div>

      <ScrollArea className="flex-1 basis-0 min-h-0 -mx-2">
        <div className="px-2 space-y-3 pb-2">
          {project.adrs.map((adr) => {
            const href = `/projects/${project.slug}/adrs/${adr.slug}`;
            const isActive = pathname === href;

            return (
              <Link
                key={adr.slug}
                href={href}
                onClick={onLinkClick}
                className={cn(
                  "flex flex-col gap-2 p-3 rounded-lg text-sm transition-all border",
                  isActive
                    ? "bg-accent text-accent-foreground border-accent-foreground/20 shadow-sm"
                    : "text-muted-foreground border-border hover:bg-accent/50 hover:text-accent-foreground hover:border-accent",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs opacity-70">
                    {adr.slug}
                  </span>
                  <Badge
                    variant={
                      adr.status === "Rejected" ? "destructive" : "default"
                    }
                    className={cn(
                      "text-[10px] h-5 px-1.5",
                      getADRStatusBadgeClasses(adr.status),
                    )}
                  >
                    {adr.status}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "font-medium leading-tight",
                    isActive && "text-foreground",
                  )}
                >
                  {adr.title}
                </div>
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
