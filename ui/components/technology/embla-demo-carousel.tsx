"use client";

import { ContentCarousel } from "@/components/ui/content-carousel";

type Slide = {
  id: number;
  label: string;
  color: string;
};

const DEMO_SLIDES: Slide[] = [
  { id: 1, label: "Slide 1", color: "bg-blue-500" },
  { id: 2, label: "Slide 2", color: "bg-green-500" },
  { id: 3, label: "Slide 3", color: "bg-purple-500" },
  { id: 4, label: "Slide 4", color: "bg-orange-500" },
  { id: 5, label: "Slide 5", color: "bg-pink-500" },
];

export function EmblaDemoCarousel() {
  return (
    <ContentCarousel
      items={DEMO_SLIDES}
      getItemKey={(slide) => `slide-${slide.id}`}
      autoScroll
      renderItem={(slide) => (
        <div
          className={`${slide.color} rounded-lg h-48 flex items-center justify-center text-white text-2xl font-bold shadow-md`}
        >
          {slide.label}
        </div>
      )}
    />
  );
}
