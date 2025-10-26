import { Suspense } from "react";
import { BlogList } from "@/components/blog/blog-list";
import { getAllPosts } from "@/lib/blog";

export default function BlogPage() {
  const allPosts = getAllPosts();

  return (
    <Suspense fallback={<BlogListFallback />}>
      <BlogList posts={allPosts} />
    </Suspense>
  );
}

function BlogListFallback() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <p className="text-muted-foreground">Loading posts...</p>
    </div>
  );
}
