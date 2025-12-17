import Link from "next/link";
import { BlogCollectionTabs } from "@/components/blog/blog-collection-tabs";
import { Button } from "@/components/ui/button";
import {
  getCollectionPosts,
  getCollectionsWithIds,
} from "@/lib/blog-collections";
import { siteConfig } from "@/lib/site-config";

export default function Home() {
  const collections = getCollectionsWithIds();
  const collectionPosts = Object.fromEntries(
    collections.map((c) => [c.id, getCollectionPosts(c.id)]),
  );

  return (
    <div className="container mx-auto px-4">
      <section className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            {siteConfig.name}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            {siteConfig.description}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto"
            >
              <Link href="/blog">Read Blog</Link>
            </Button>
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/projects">Explore Projects</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto"
            >
              <Link href="/experience">View Experience</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <BlogCollectionTabs
          collections={collections}
          collectionPosts={collectionPosts}
          defaultCollectionId="all"
        />
      </section>
    </div>
  );
}
