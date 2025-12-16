"use client";

import type { EmblaCarouselType, EmblaOptionsType } from "embla-carousel";
import AutoScroll from "embla-carousel-auto-scroll";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DotButton,
  useDotButton,
  usePrevNextButtons,
} from "@/components/ui/carousel";
import type { BlogPost } from "@/lib/blog";
import { defaultCarouselConfig } from "@/lib/carousel-config";
import { getImageUrl } from "@/lib/cloudflare-images";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/styles";

type BlogCarouselProps = {
  posts: BlogPost[];
  options?: EmblaOptionsType;
  autoScroll?: boolean;
  scrollSpeed?: number;
  stopOnInteraction?: boolean;
  stopOnMouseEnter?: boolean;
  playOnInit?: boolean;
  startDelay?: number;
};

export function BlogCarousel({
  posts,
  options,
  autoScroll = defaultCarouselConfig.autoScroll,
  scrollSpeed = defaultCarouselConfig.scrollSpeed,
  stopOnInteraction = defaultCarouselConfig.stopOnInteraction,
  stopOnMouseEnter = defaultCarouselConfig.stopOnMouseEnter,
  playOnInit = defaultCarouselConfig.playOnInit,
  startDelay = defaultCarouselConfig.startDelay,
}: BlogCarouselProps) {
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
          {posts.map((post, index) => (
            <div
              key={post.slug}
              className="flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
            >
              <Link href={`/blog/${post.slug}`} className="group block h-full">
                <Card className="h-full flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/50">
                  {post.image && (
                    <div className="relative w-full h-40 bg-muted overflow-hidden">
                      {/* biome-ignore lint/performance/noImgElement: Need native img for srcset control with SSG */}
                      <img
                        src={getImageUrl(post.image, null, {
                          width: 400,
                          format: "auto",
                        })}
                        alt={post.imageAlt || post.title}
                        width={400}
                        height={160}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : undefined}
                      />
                    </div>
                  )}
                  <CardHeader className="flex-1">
                    <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {post.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <time>{formatDate(post.date)}</time>
                      <span className="mx-2">·</span>
                      <span>{post.readingTime}</span>
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
          className="flex gap-2 border-0 p-0 min-h-[8px]"
          aria-label="Carousel pagination"
        >
          {scrollSnaps.map((snap, index) => (
            <DotButton
              key={`dot-${snap}`}
              onClick={() => onDotButtonClick(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                index === selectedIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selectedIndex ? "true" : undefined}
            />
          ))}
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
