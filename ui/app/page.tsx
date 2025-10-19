import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="container mx-auto px-4">
      <section className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">Robbie Palmer</h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            [Your tagline here]
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/blog">Read Blog</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/experience">View Experience</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
