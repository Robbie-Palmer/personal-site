export type CarouselConfig = {
  autoScroll: boolean;
  scrollSpeed: number;
  stopOnInteraction: boolean;
  stopOnMouseEnter: boolean;
  playOnInit: boolean;
  startDelay: number;
};

export const defaultCarouselConfig: CarouselConfig = {
  autoScroll: true,
  scrollSpeed: 2,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
  playOnInit: true,
  startDelay: 300,
} as const;
