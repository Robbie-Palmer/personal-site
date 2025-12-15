"use client";

import Fuse from "fuse.js";
import { ArrowDown, ArrowUp, Clock, Search, Tag, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BlogPost } from "@/lib/blog";
import { getImageUrl } from "@/lib/cloudflare-images";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/styles";

interface BlogListProps {
  posts: BlogPost[];
}

type SortOption = "newest" | "oldest" | "updated";

export function BlogList({ posts }: BlogListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");
  const sortParam = searchParams.get("sort") as SortOption | null;
  const currentSort: SortOption = sortParam || "newest";
  const [searchQuery, setSearchQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: "title", weight: 3 },
          { name: "description", weight: 2 },
          { name: "tags", weight: 2 },
          { name: "content", weight: 1 },
        ],
        threshold: 0.1,
        ignoreLocation: true,
      }),
    [posts],
  );

  let filteredPosts = searchQuery.trim()
    ? fuse.search(searchQuery).map((result) => result.item)
    : posts;

  if (currentTag) {
    filteredPosts = filteredPosts.filter((post) =>
      post.tags.includes(currentTag),
    );
  }

  // Apply sorting
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (currentSort === "oldest") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (currentSort === "updated") {
      // Use updated date if available, otherwise fall back to date
      const aDate = new Date(a.updated || a.date).getTime();
      const bDate = new Date(b.updated || b.date).getTime();
      return bDate - aDate; // Most recent first
    }
    // Default: newest
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const cycleSortOrder = () => {
    const sortCycle: SortOption[] = ["newest", "oldest", "updated"];
    const currentIndex = sortCycle.indexOf(currentSort);
    const nextSort = sortCycle[
      (currentIndex + 1) % sortCycle.length
    ] as SortOption;

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextSort === "newest") {
      params.delete("sort");
    } else {
      params.set("sort", nextSort);
    }
    const queryString = params.toString();
    router.push(`/blog${queryString ? `?${queryString}` : ""}`);
  };

  const getSortIcon = () => {
    switch (currentSort) {
      case "oldest":
        return <ArrowUp className="h-4 w-4" />;
      case "updated":
        return <Clock className="h-4 w-4" />;
      default:
        return <ArrowDown className="h-4 w-4" />;
    }
  };

  const getSortLabel = () => {
    switch (currentSort) {
      case "oldest":
        return "Oldest first";
      case "updated":
        return "Recently updated";
      default:
        return "Newest first";
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 min-h-screen">
      <div className="flex flex-wrap items-baseline gap-4 mb-6">
        <h1 className="text-4xl font-bold">Blog</h1>
        {currentTag && (
          <Badge
            variant="secondary"
            className="flex items-center gap-2 text-base px-3 py-1 hover:bg-primary/20 hover:text-primary border border-transparent transition-colors"
          >
            <Tag className="h-4 w-4" />
            <span>{currentTag}</span>
            <Link
              href="/blog"
              className="rounded-full hover:bg-background/50 p-0.5 ml-1 transition-colors"
              aria-label={`Remove ${currentTag} filter`}
            >
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search blog posts"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={cycleSortOrder}
          title={getSortLabel()}
          aria-label={`Sort: ${getSortLabel()}. Click to change sort order.`}
        >
          {getSortIcon()}
        </Button>
      </div>

      {(searchQuery || currentTag) && sortedPosts.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Showing {sortedPosts.length} of {posts.length} posts
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}
        </p>
      )}

      {sortedPosts.length === 0 ? (
        <p className="text-muted-foreground">
          No posts found
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedPosts.map((post, index) => (
            <Card
              key={post.slug}
              className="h-full flex flex-col overflow-hidden"
            >
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
                      fetchPriority={index < 3 ? "high" : undefined}
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
                        href={`/blog?tag=${encodeURIComponent(tag)}`}
                      >
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={cn(
                            "gap-1 transition-colors border",
                            isActive
                              ? "hover:bg-primary/90 border-transparent"
                              : "hover:bg-primary/20 hover:text-primary hover:border-primary/30 border-transparent",
                          )}
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
          ))}
        </div>
      )}
    </div>
  );
}
