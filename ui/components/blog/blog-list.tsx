"use client";

import { FileText, Tag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  createTagFilterOptions,
  createTechFilterOptions,
  useCommandPalette,
} from "@/components/command-palette";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterableCardGrid } from "@/components/ui/filterable-card-grid";
import { useFilterParams } from "@/hooks/use-filter-params";
import type { BlogPost } from "@/lib/api/blog";
import { hasTechIcon, TechIcon } from "@/lib/api/tech-icons";
import { formatDate } from "@/lib/generic/date";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

interface BlogListProps {
  posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const post of posts) {
      for (const tag of post.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }, [posts]);
  const allTechnologies = useMemo(() => {
    const techMap = new Map<
      string,
      { slug: string; name: string; iconSlug?: string }
    >();
    for (const post of posts) {
      for (const tech of post.technologies) {
        if (!techMap.has(tech.slug)) {
          techMap.set(tech.slug, tech);
        }
      }
    }
    return Array.from(techMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [posts]);
  const filterParams = useFilterParams({
    filters: [
      { paramName: "tags", isMulti: true },
      { paramName: "tech", isMulti: true },
    ],
  });
  const selectedTags = filterParams.getValues("tags");
  const selectedTech = filterParams.getValues("tech");
  const { registerFilters, unregisterFilters } = useCommandPalette();

  useEffect(() => {
    const filters = [
      ...createTagFilterOptions(allTags),
      ...createTechFilterOptions(allTechnologies),
    ];
    registerFilters(filters);
    return () => unregisterFilters();
  }, [allTags, allTechnologies, registerFilters, unregisterFilters]);

  return (
    <FilterableCardGrid
      items={posts}
      getItemKey={(post) => post.slug}
      searchConfig={{
        placeholder: "Search posts...",
        ariaLabel: "Search blog posts",
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "tags", weight: 2 },
          { name: "technologies.name", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.1,
      }}
      filterConfigs={[
        {
          paramName: "tags",
          isMulti: true,
          label: "Tags",
          getItemValues: (post) => post.tags,
          icon: <Tag className="h-4 w-4" />,
          getValueLabel: (value) => value,
          getOptionIcon: () => <Tag className="h-3 w-3" />,
        },
        {
          paramName: "tech",
          isMulti: true,
          label: "Tech",
          getItemValues: (post) => post.technologies.map((t) => t.slug),
          getValueLabel: (value) => {
            const tech = allTechnologies.find((t) => t.slug === value);
            return tech?.name ?? value;
          },
          getOptionIcon: (value) => {
            const tech = allTechnologies.find((t) => t.slug === value);
            if (!tech || !hasTechIcon(tech.name, tech.iconSlug)) return null;
            return (
              <TechIcon
                name={tech.name}
                iconSlug={tech.iconSlug}
                className="w-3 h-3 grayscale"
              />
            );
          },
        },
      ]}
      dateRangeConfig={{
        getDate: (post) => post.date,
      }}
      sortConfig={{
        getDate: (post) => post.date,
        getUpdated: (post) => post.updated,
      }}
      emptyState={{
        icon: <FileText className="w-10 h-10 text-muted-foreground/50" />,
        message: "No posts found matching your criteria.",
      }}
      itemName="posts"
      renderCard={(post, index) => (
        <Card className="h-full flex flex-col overflow-hidden">
          {post.image && (
            <Link href={`/blog/${post.slug}`} className="block">
              <div className="relative w-full h-48 bg-muted overflow-hidden">
                {/* biome-ignore lint/performance/noImgElement: Need native img for srcset control with SSG */}
                <img
                  src={getImageUrl(post.image, null, {
                    width: 400,
                    format: "auto",
                  })}
                  alt={post.imageAlt || post.title}
                  width={400}
                  height={192}
                  className="w-full h-full object-cover"
                  loading={index < 6 ? "eager" : "lazy"}
                  fetchPriority={index < 3 ? "high" : "auto"}
                />
              </div>
            </Link>
          )}
          <CardHeader>
            <Link href={`/blog/${post.slug}`}>
              <CardTitle className="hover:text-primary transition-colors">
                {post.title}
              </CardTitle>
            </Link>
            <CardDescription>{post.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="flex flex-wrap gap-2 mb-3">
              {post.tags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isActive ? "default" : "secondary"}
                    interactive
                    active={isActive}
                    className="gap-1 cursor-pointer"
                    onClick={() => filterParams.toggleValue("tags", tag)}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                );
              })}
            </div>
            {post.technologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.technologies.slice(0, 4).map((tech) => {
                  const isActive = selectedTech.includes(tech.slug);
                  return (
                    <Badge
                      key={tech.slug}
                      variant={isActive ? "default" : "outline"}
                      interactive
                      active={isActive}
                      className="gap-1 text-xs cursor-pointer"
                      onClick={() =>
                        filterParams.toggleValue("tech", tech.slug)
                      }
                    >
                      {hasTechIcon(tech.name, tech.iconSlug) && (
                        <TechIcon
                          name={tech.name}
                          iconSlug={tech.iconSlug}
                          className="h-3 w-3"
                        />
                      )}
                      {tech.name}
                    </Badge>
                  );
                })}
                {post.technologies.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{post.technologies.length - 4}
                  </Badge>
                )}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              <time>{formatDate(post.date)}</time>
              <span className="mx-2">·</span>
              <span>{post.readingTime}</span>
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
