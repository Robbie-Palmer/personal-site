import { Github, Linkedin } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="https://github.com/Robbie-Palmer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:opacity-60 transition-opacity"
              aria-label="GitHub"
            >
              <Github className="h-6 w-6" />
            </Link>
            <Link
              href={siteConfig.author.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:opacity-60 transition-opacity"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-6 w-6" />
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            <Link
              href="https://github.com/Robbie-Palmer/personal-site"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline decoration-dotted underline-offset-4"
            >
              View Source
            </Link>
            {" · "}© {currentYear} {siteConfig.author.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
