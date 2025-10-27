"use client";

import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BlogPost } from "@/lib/blog";
import { formatDate } from "@/lib/date";

interface BlogListProps {
  posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");
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

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-wrap items-baseline gap-4 mb-6">
        <h1 className="text-4xl font-bold">Blog</h1>
        {currentTag && (
          <Badge
            variant="outline"
            className="flex items-center gap-2 text-base"
          >
            <span>{currentTag}</span>
            <Link
              href="/blog"
              className="rounded-full hover:bg-muted/50 p-0.5"
              aria-label={`Remove ${currentTag} filter`}
            >
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        )}
      </div>

      <div className="relative mb-6 max-w-md">
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

      {(searchQuery || currentTag) && filteredPosts.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Showing {filteredPosts.length} of {posts.length} posts
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}
        </p>
      )}

      {filteredPosts.length === 0 ? (
        <p className="text-muted-foreground">
          No posts found
          {searchQuery && ` matching "${searchQuery}"`}
          {currentTag && ` with tag "${currentTag}"`}.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <Card key={post.slug} className="h-full flex flex-col">
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
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                    >
                      <Badge variant="secondary">{tag}</Badge>
                    </Link>
                  ))}
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
