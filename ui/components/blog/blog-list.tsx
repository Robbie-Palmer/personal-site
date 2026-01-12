"use client";

import { FileText, Tag } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterableCardGrid } from "@/components/ui/filterable-card-grid";
import type { BlogPost } from "@/lib/api/blog";
import { formatDate } from "@/lib/generic/date";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";

interface BlogListProps {
  posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");

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
          { name: "content", weight: 1 },
        ],
        threshold: 0.1,
      }}
      filterConfig={{
        paramName: "tag",
        getItemValues: (post) => post.tags,
        icon: <Tag className="h-4 w-4" />,
        clearUrl: "/blog",
        labelPrefix: "with tag",
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
                const isActive = tag === currentTag;
                return (
                  <Link
                    key={tag}
                    href={
                      isActive
                        ? "/blog"
                        : `/blog?tag=${encodeURIComponent(tag)}`
                    }
                  >
                    <Badge
                      variant={isActive ? "default" : "secondary"}
                      interactive
                      active={isActive}
                      className="gap-1"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </Badge>
                  </Link>
                );
              })}
            </div>
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
