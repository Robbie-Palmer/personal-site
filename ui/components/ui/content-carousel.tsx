"use client";

import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DotButton,
  useDotButton,
  usePrevNextButtons,
} from "@/components/ui/carousel";
import { defaultCarouselConfig } from "@/lib/carousel-config";
import { cn } from "@/lib/styles";

export type ContentCarouselProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  options?: EmblaOptionsType;
  autoScroll?: boolean;
  scrollSpeed?: number;
  stopOnInteraction?: boolean;
  stopOnMouseEnter?: boolean;
  playOnInit?: boolean;
  startDelay?: number;
  className?: string;
  itemClassName?: string;
  getItemKey?: (item: T, index: number) => string;
};

export function ContentCarousel<T>({
  items,
  renderItem,
  options,
  autoScroll = defaultCarouselConfig.autoScroll,
  scrollSpeed = defaultCarouselConfig.scrollSpeed,
  stopOnInteraction = defaultCarouselConfig.stopOnInteraction,
  stopOnMouseEnter = defaultCarouselConfig.stopOnMouseEnter,
  playOnInit = defaultCarouselConfig.playOnInit,
  startDelay = defaultCarouselConfig.startDelay,
  className,
  itemClassName,
  getItemKey,
}: ContentCarouselProps<T>) {
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
    <div className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {items.map((item, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Fallback if no key provided
              key={getItemKey ? getItemKey(item, index) : index}
              className={cn(
                "flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.333%]",
                itemClassName,
              )}
            >
              {renderItem(item, index)}
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
