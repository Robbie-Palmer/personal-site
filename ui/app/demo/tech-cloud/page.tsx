"use client";

import {
  TechIconCloud,
  type TechIconCloudItem,
} from "@/components/ui/tech-icon-cloud";
import { getTechUrl } from "@/lib/tech-icons";

export default function TechCloudDemoPage() {
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
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Interactive Tech Stack Cloud
        </h1>
        <p className="text-muted-foreground text-center mb-12">
          Hover over icons to see their names. Click to visit their websites.
          Drag to rotate the cloud.
        </p>

        <div className="flex justify-center">
          <TechIconCloud
            technologies={technologies}
            size={600}
            enableNavigation={true}
            className="w-full max-w-2xl"
            onIconClick={(tech) => {
              console.log("Clicked:", tech.name);
            }}
          />
        </div>

        <div className="mt-16 space-y-4">
          <h2 className="text-2xl font-semibold">Features</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>Interactive 3D rotation</strong> - Drag to rotate the
              sphere
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
              <strong>Click to navigate</strong> - Click icons to visit their
              official websites
            </li>
            <li>
              <strong>Auto-rotation</strong> - Cloud rotates slowly based on
              mouse position
            </li>
            <li>
              <strong>Click to center</strong> - Click an icon to smoothly
              rotate it to the front
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
