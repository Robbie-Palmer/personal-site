import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { getAllPosts } from "@/lib/api/blog";

export default function NotFound() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-12 text-center flex flex-col items-center justify-center flex-1">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="mt-4 text-2xl font-medium text-foreground">
        Page Not Found
      </p>
      <p className="mt-2 text-muted-foreground">
        Sorry, the page you are looking for does not exist. <br />
        Perhaps one of these recent posts is what you were looking for?
      </p>

      {recentPosts.length > 0 && (
        <div className="mt-12">
          <div className="grid gap-4 md:grid-cols-3 lg:max-w-4xl mx-auto">
            {recentPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}>
                <Card className="h-full hover:border-primary transition-colors flex items-center justify-center p-4 text-center">
                  <CardTitle>{post.title}</CardTitle>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
