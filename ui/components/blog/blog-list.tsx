"use client";

import { X } from "lucide-react";
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
import type { BlogPostMetadata } from "@/lib/blog";

interface BlogListProps {
  posts: BlogPostMetadata[];
}

export function BlogList({ posts }: BlogListProps) {
  const searchParams = useSearchParams();
  const currentTag = searchParams.get("tag");

  const filteredPosts = currentTag
    ? posts.filter((post) => post.tags.includes(currentTag))
    : posts;

  if (filteredPosts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Blog</h1>
        <p className="text-muted-foreground">
          No posts found{currentTag && ` for tag "${currentTag}"`}. Showing 0 of{" "}
          {posts.length} posts.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-wrap items-baseline gap-4 mb-2">
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

      {currentTag && (
        <p className="text-sm text-muted-foreground mb-6">
          Showing {filteredPosts.length} of {posts.length} posts
        </p>
      )}

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
                  <Link key={tag} href={`/blog?tag=${tag}`}>
                    <Badge variant="secondary">{tag}</Badge>
                  </Link>
                ))}
              </div>
              <time className="text-sm text-muted-foreground">
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
