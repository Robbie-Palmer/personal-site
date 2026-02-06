"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { BlogListItemView } from "@/lib/domain/blog/blogViews";
import { cn } from "@/lib/generic/styles";

interface BlogBadgeProps {
  blog: BlogListItemView;
  className?: string;
}

export function BlogBadge({ blog, className }: BlogBadgeProps) {
  return (
    <Link
      href={`/blog/${blog.slug}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`View blog post ${blog.title}`}
    >
      <Badge
        variant="outline"
        interactive
        className={cn("max-w-48 sm:max-w-none justify-start", className)}
      >
        <span className="truncate">{blog.title}</span>
      </Badge>
    </Link>
  );
}
