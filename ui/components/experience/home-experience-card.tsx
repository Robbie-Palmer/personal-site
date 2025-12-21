"use client";

import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Experience } from "@/lib/experience";
import { formatDateRange } from "@/lib/experience";

interface HomeExperienceCardProps {
  experience: Experience;
}

export function HomeExperienceCard({ experience }: HomeExperienceCardProps) {
  return (
    <Link href="/experience" className="block group h-full">
      <Card className="h-full md:aspect-square flex flex-col justify-center p-4 md:p-6 transition-all duration-200 hover:shadow-md hover:border-primary/50 group-hover:-translate-y-1">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative w-12 h-12 shrink-0 bg-muted rounded-md overflow-hidden border border-border p-1">
            <Image
              src={experience.logo_path}
              alt={`${experience.company} logo`}
              fill
              className="object-contain p-1"
            />
          </div>

          <div className="min-w-0 w-full">
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              {experience.title}
            </h3>

            <p className="text-sm text-muted-foreground">
              {experience.company}
            </p>

            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mt-3 leading-relaxed">
              {(() => {
                const fullDate = formatDateRange(
                  experience.startDate,
                  experience.endDate,
                );
                const [dateRange, duration] = fullDate.split("(");
                return (
                  <>
                    <div className="mb-0.5">{dateRange?.trim()}</div>
                    {duration && (
                      <div className="opacity-70">({duration.trim()}</div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
