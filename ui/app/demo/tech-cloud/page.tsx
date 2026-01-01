"use client";

import {
  TechIconCloud,
  type TechIconCloudItem,
} from "@/components/ui/tech-icon-cloud";
import { getTechUrl } from "@/lib/tech-icons";
import { useEffect, useState } from "react";

export default function TechCloudDemoPage() {
  const [canvasSize, setCanvasSize] = useState(600);

  useEffect(() => {
    const updateSize = () => {
      // Responsive canvas size: 600px on desktop, smaller on mobile
      const width = window.innerWidth;
      if (width < 640) {
        setCanvasSize(Math.min(width - 32, 400)); // Mobile: smaller, with padding
      } else if (width < 1024) {
        setCanvasSize(500); // Tablet
      } else {
        setCanvasSize(600); // Desktop
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const technologies: TechIconCloudItem[] = [
    { name: "React", weight: 3, url: getTechUrl("React") },
    { name: "Next.js", weight: 3, url: getTechUrl("Next.js") },
    { name: "TypeScript", weight: 3, url: getTechUrl("TypeScript") },
    { name: "Tailwind CSS", weight: 2, url: getTechUrl("Tailwind CSS") },
    { name: "shadcn/ui", weight: 2, url: getTechUrl("shadcn/ui") },
    { name: "Vitest", weight: 2, url: getTechUrl("Vitest") },
    { name: "pnpm", weight: 2, url: getTechUrl("pnpm") },
    { name: "Zod", weight: 2, url: getTechUrl("Zod") },
    { name: "MDX", weight: 2, url: getTechUrl("MDX") },
    { name: "Recharts", weight: 1, url: getTechUrl("Recharts") },
    { name: "Fuse.js", weight: 1, url: getTechUrl("Fuse.js") },
    { name: "Shiki", weight: 1, url: getTechUrl("Shiki") },
    { name: "Embla Carousel", weight: 1, url: getTechUrl("Embla Carousel") },
    { name: "Mermaid", weight: 1, url: getTechUrl("Mermaid") },
    { name: "GitHub Actions", weight: 1, url: getTechUrl("GitHub Actions") },
    { name: "Terraform", weight: 1, url: getTechUrl("Terraform") },
    { name: "Cloudflare Pages", weight: 1, url: getTechUrl("Cloudflare Pages") },
    { name: "Doppler", weight: 1, url: getTechUrl("Doppler") },
    { name: "Mise", weight: 1, url: getTechUrl("Mise") },
    { name: "Claude Code", weight: 1, url: getTechUrl("Claude Code") },
  ];

  return (
    <main className="container mx-auto px-4 py-8 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
          Interactive Tech Stack Cloud
        </h1>
        <p className="text-muted-foreground text-center mb-8 sm:mb-12 text-sm sm:text-base">
          <span className="hidden sm:inline">
            Hover over icons to see their names. Click to visit their websites.
            Drag to rotate the cloud.
          </span>
          <span className="sm:hidden">
            Tap icons to visit websites. Drag to rotate the cloud.
          </span>
        </p>

        <div className="flex justify-center">
          <TechIconCloud
            technologies={technologies}
            size={canvasSize}
            enableNavigation={true}
            className="w-full max-w-2xl"
            onIconClick={(tech) => {
              console.log("Clicked:", tech.name);
            }}
          />
        </div>

        <div className="mt-12 sm:mt-16 space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold">Features</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm sm:text-base">
            <li>
              <strong>Interactive 3D rotation</strong> - Drag to rotate the
              sphere (works with touch on mobile!)
            </li>
            <li>
              <strong>Mobile & Desktop support</strong> - Full touch support
              with responsive sizing
            </li>
            <li>
              <strong>Weighted sizing</strong> - Technologies are sized based on
              importance (1-3x weight)
            </li>
            <li>
              <strong>Hover effects</strong> - Icons glow and scale up when
              hovered
            </li>
            <li>
              <strong>Tap/Click to navigate</strong> - Tap or click icons to
              visit their official websites
            </li>
            <li>
              <strong>Auto-rotation</strong> - Cloud rotates slowly based on
              cursor/touch position
            </li>
            <li>
              <strong>Tap/Click to center</strong> - Tap or click an icon to
              smoothly rotate it to the front
            </li>
          </ul>
        </div>

        <div className="mt-12 p-6 border rounded-lg bg-muted/50">
          <h3 className="text-lg font-semibold mb-4">Usage Example</h3>
          <pre className="text-sm overflow-x-auto">
            {`import { TechIconCloud } from "@/components/ui/tech-icon-cloud";

const technologies = [
  { name: "React", weight: 3, url: "https://react.dev" },
  { name: "TypeScript", weight: 2, url: "https://typescriptlang.org" },
  // ... more technologies
];

<TechIconCloud
  technologies={technologies}
  size={600}
  enableNavigation={true}
  onIconClick={(tech) => console.log("Clicked:", tech.name)}
/>`}
          </pre>
        </div>
      </div>
    </main>
  );
}
