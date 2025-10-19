import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { useMDXComponents } from "@/components/mdx-components";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  return (
    <article className="container mx-auto px-4 py-12 max-w-4xl">
      <Link
        href="/blog"
        className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
      >
        ← Back to blog
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-xl text-muted-foreground mb-4">{post.description}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <time className="text-muted-foreground">
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>

          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <Separator className="mb-8" />

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <MDXRemote
          source={post.content}
          components={useMDXComponents({})}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                rehypeAutolinkHeadings,
                rehypeHighlight,
              ],
            },
          }}
        />
      </div>
    </article>
  );
}
