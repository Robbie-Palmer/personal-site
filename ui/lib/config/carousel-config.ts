export type CarouselConfig = {
  autoScroll: boolean;
  scrollSpeed: number;
  stopOnInteraction: boolean;
  stopOnMouseEnter: boolean;
};

export const defaultCarouselConfig: CarouselConfig = {
  autoScroll: true,
  scrollSpeed: 2,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
} as const;
