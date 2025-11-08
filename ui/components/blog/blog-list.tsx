"use client";

import Link from "next/link";
import { ContentList } from "@/components/content/content-list";
import { Badge } from "@/components/ui/badge";
import type { BlogPost } from "@/lib/blog";
import { formatDate } from "@/lib/date";

interface BlogListProps {
  posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
  return (
    <ContentList
      items={posts}
      contentType="blog"
      displayName="Blog"
      searchKeys={[
        { name: "title", weight: 3 },
        { name: "description", weight: 2 },
        { name: "tags", weight: 2 },
        { name: "content", weight: 1 },
      ]}
      renderCardContent={() => null}
      renderCardFooter={(post) => (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary">{tag}</Badge>
              </Link>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            <time>{formatDate(post.date)}</time>
            <span className="mx-2">·</span>
            <span>{post.readingTime}</span>
          </div>
        </>
      )}
    />
  );
}
