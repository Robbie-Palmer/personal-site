"use client";

import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DotButton,
  useDotButton,
  usePrevNextButtons,
} from "@/components/ui/carousel";
import { defaultCarouselConfig } from "@/lib/carousel-config";
import { formatDate } from "@/lib/date";
import type { ProjectADR } from "@/lib/projects";
import { cn } from "@/lib/styles";
import { getTechUrl, TechIcon } from "@/lib/tech-icons";
import { ADRBadge } from "./adr-badge";

type ADRCarouselProps = {
  adrs: ProjectADR[];
  options?: EmblaOptionsType;
  autoScroll?: boolean;
  scrollSpeed?: number;
  stopOnInteraction?: boolean;
  stopOnMouseEnter?: boolean;
  playOnInit?: boolean;
  startDelay?: number;
};

export function ADRCarousel({
  adrs,
  options,
  autoScroll = defaultCarouselConfig.autoScroll,
  scrollSpeed = defaultCarouselConfig.scrollSpeed,
  stopOnInteraction = defaultCarouselConfig.stopOnInteraction,
  stopOnMouseEnter = defaultCarouselConfig.stopOnMouseEnter,
  playOnInit = defaultCarouselConfig.playOnInit,
  startDelay = defaultCarouselConfig.startDelay,
}: ADRCarouselProps) {
  const plugins = autoScroll
    ? [
        AutoScroll({
          speed: scrollSpeed,
          stopOnInteraction,
          stopOnMouseEnter,
          playOnInit,
          startDelay,
        }),
      ]
    : [];

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      ...options,
    },
    plugins,
  );

  const onNavButtonClick = useCallback((emblaApi: EmblaCarouselType) => {
    const autoScrollPlugin = emblaApi?.plugins()?.autoScroll;
    if (!autoScrollPlugin) return;
    autoScrollPlugin.reset();
  }, []);

  const { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(
    emblaApi,
    onNavButtonClick,
  );

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi, onNavButtonClick);

  // Start auto-scroll immediately when carousel is ready
  useEffect(() => {
    if (!emblaApi || !autoScroll) return;
    const autoScrollPlugin = emblaApi.plugins()?.autoScroll;
    if (autoScrollPlugin) {
      autoScrollPlugin.play();
    }
  }, [emblaApi, autoScroll]);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {adrs.map((adr) => (
            <div
              key={`${adr.projectSlug}-${adr.slug}`}
              className="flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
            >
              <Link
                href={`/projects/${adr.projectSlug}/adrs/${adr.slug}`}
                className="group block h-full"
              >
                <Card className="h-full flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 relative">
                  <div className="absolute top-4 left-4 right-20 z-10">
                    <div
                      className="text-lg font-semibold text-muted-foreground truncate"
                      title={adr.projectTitle}
                    >
                      {adr.projectTitle}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <ADRBadge status={adr.status} />
                  </div>
                  <CardHeader className="flex-1 pt-12 mt-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors text-lg flex-1">
                          {adr.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 flex-shrink-0 pt-0.5">
                          {adr.tech_stack?.slice(0, 5).map((tech) => {
                            const url = getTechUrl(tech);
                            const Icon = (
                              <TechIcon
                                name={tech}
                                className="w-12 h-12 text-foreground transition-all"
                              />
                            );

                            if (url) {
                              return (
                                <a
                                  key={tech}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={tech}
                                  onClick={(e) => e.stopPropagation()}
                                  className="z-10 relative p-1.5 rounded-md hover:bg-muted transition-colors -m-1.5"
                                >
                                  {Icon}
                                </a>
                              );
                            }
                            return (
                              <div
                                key={tech}
                                title={tech}
                                className="p-1.5 -m-1.5"
                              >
                                {Icon}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground">
                      <time>{formatDate(adr.date)}</time>
                      <span className="mx-2">·</span>
                      <span>{adr.readingTime}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-8 h-10">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
          aria-label="Previous slide"
          className="rounded-full"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <fieldset
          className="flex gap-2 border-0 p-0 min-h-[8px] flex-wrap justify-center px-4"
          aria-label="Carousel pagination"
        >
          {scrollSnaps.map((_, index) => {
            // Limit the number of dots to prevent overflow on mobile
            // If we have too many dots, we only show every Nth dot
            const MAX_DOTS = 10;
            const totalSnaps = scrollSnaps.length;
            const step = Math.ceil(totalSnaps / MAX_DOTS);

            if (index % step !== 0) {
              return null;
            }

            const isActive = Math.floor(selectedIndex / step) * step === index;

            return (
              <DotButton
                key={`dot-${scrollSnaps[index]}`}
                onClick={() => onDotButtonClick(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  isActive
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
              />
            );
          })}
        </fieldset>

        <Button
          variant="outline"
          size="icon"
          onClick={onNextButtonClick}
          disabled={nextBtnDisabled}
          aria-label="Next slide"
          className="rounded-full"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
