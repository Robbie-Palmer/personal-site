# TechIconCloud Component

An interactive 3D icon cloud component for displaying technology stacks with weighted sizing, hover effects, and click interactions.

## Features

- **Interactive 3D Rotation** - Drag to rotate the sphere manually
- **Auto-Rotation** - Cloud rotates slowly based on mouse position
- **Weighted Sizing** - Technologies can be sized 1x-3x based on importance
- **Hover Effects** - Icons glow and scale up (1.2x) when hovered
- **Click Interactions** - Navigate to URLs or trigger custom handlers
- **Click to Center** - Click an icon to smoothly rotate it to the front
- **Tech Name Display** - Shows hovered technology name below the cloud

## Usage

```tsx
import { TechIconCloud, TechIconCloudItem } from "@/components/ui/tech-icon-cloud";

const technologies: TechIconCloudItem[] = [
  { name: "React", weight: 3, url: "https://react.dev" },
  { name: "TypeScript", weight: 2, url: "https://typescriptlang.org" },
  { name: "Tailwind CSS", weight: 2 },
];

<TechIconCloud
  technologies={technologies}
  size={600}
  enableNavigation={true}
  onIconClick={(tech) => console.log("Clicked:", tech.name)}
/>
```

## Props

### TechIconCloudProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `technologies` | `TechIconCloudItem[]` | Required | Array of technology items to display |
| `size` | `number` | `500` | Canvas size in pixels (square) |
| `className` | `string` | `undefined` | Additional CSS classes for the container |
| `onIconClick` | `(tech: TechIconCloudItem, index: number) => void` | `undefined` | Callback when icon is clicked |
| `enableNavigation` | `boolean` | `false` | If true, clicking navigates to `tech.url` |

### TechIconCloudItem

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Technology name (used for icon lookup) |
| `slug` | `string` | No | Custom slug for icon lookup |
| `weight` | `number` | No | Icon weight/importance (1-3, default: 1) |
| `brandColor` | `string` | No | Brand color for the icon |
| `url` | `string` | No | External URL or internal path to navigate to |

## Weight System

The `weight` property controls how many times an icon appears in the cloud:

- `weight: 1` - Appears once (default)
- `weight: 2` - Appears twice (more prominent)
- `weight: 3` - Appears three times (most prominent)

Higher weight = more instances = appears larger in aggregate.

## Navigation

When `enableNavigation` is `true` and a `url` is provided:

- **External URLs** (starting with `http`): Opens in new tab
- **Internal paths**: Uses Next.js router for client-side navigation

## Integration with Existing Icons

The component automatically integrates with the existing tech icon system:

- Uses `TechIcon` component for rendering
- Supports custom SVGs in `/public/tech-icons/`
- Falls back to Simple Icons library
- Respects dark mode with `brightness-0 dark:invert`

## Example: Homepage Tech Stack

```tsx
import { getAllTechnologyBadges } from "@/lib/domain/technology/technologyQueries";
import { getRepository } from "@/lib/repository";

const repository = getRepository();
const allTechnologies = getAllTechnologyBadges(repository);

<TechIconCloud
  technologies={allTechnologies.map(tech => ({
    name: tech.name,
    slug: tech.slug,
    weight: calculateWeight(tech),
    brandColor: tech.brandColor,
    url: `/tech/${tech.slug}`,
  }))}
  size={600}
  enableNavigation={true}
/>
```

## Demo

Visit `/demo/tech-cloud` to see the component in action with your project's tech stack.

## Dependencies

- **Magic UI IconCloud** - Base 3D canvas implementation
- **TechIcon** - Existing tech icon rendering system
- **Simple Icons** - Icon library fallback
- **Next.js Router** - Client-side navigation

## Implementation Notes

- Component uses Canvas API for rendering
- Icons are converted to canvas offscreen buffers for performance
- Fibonacci sphere distribution ensures even spacing
- Easing function (`easeOutCubic`) for smooth animations
- Lazy animation (pauses when off-screen)
