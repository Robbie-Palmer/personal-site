#!/usr/bin/env tsx

/**
 * Generates agent-friendly Markdown twins of the site's HTML pages into the
 * static export directory (out/), following the convention popularised by
 * Neon's docs: append `.md` to a page URL to get plain Markdown, and fetch
 * /llms.txt for a structured index of everything available.
 *
 * Recipe pages additionally get schema.org Recipe JSON and Cooklang twins
 * (append `.json` or `.cook` respectively) for portable recipe export.
 */

import fs from "node:fs";
import path from "node:path";
// Import order matters: registers .wasm loading before content imports
import "./lib/register-wasm";
import { getAllPosts } from "@/lib/api/blog";
import {
  formatExperienceDateRange,
  getAllExperience,
} from "@/lib/api/experience";
import {
  getAllProjects,
  getBuildingPhilosophy,
  getProjectADR,
  type ProjectWithADRs,
} from "@/lib/api/projects";
import {
  getAllRecipes,
  getRecipeBySlug,
  type RecipeDetailView,
} from "@/lib/api/recipes";
import { siteConfig } from "@/lib/config/site-config";
import {
  markdownUrl,
  mdxToAgentMarkdown,
  renderPage,
} from "@/lib/content/agent-markdown";
import { loadDomainRepository } from "@/lib/domain";
import {
  getAllTechnologySlugs,
  getRelatedContentForTechnology,
  getTechnologyDetail,
} from "@/lib/domain/technology";
import { getImageUrl } from "@/lib/integrations/cloudflare-images";
import { buildRecipeJsonLd } from "@/lib/seo/recipe-jsonld";

function formatCooklangExport(recipe: RecipeDetailView): string {
  const ingredientAnnotations = Object.fromEntries(
    recipe.ingredientGroups
      .flatMap((group) => group.items)
      .filter((item) => item.preparation || item.note)
      .map((item) => [
        item.ingredient,
        {
          ...(item.preparation ? { preparation: item.preparation } : {}),
          ...(item.note ? { note: item.note } : {}),
        },
      ]),
  );
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(recipe.title)}`,
    `description: ${JSON.stringify(recipe.description)}`,
    `date: ${JSON.stringify(recipe.date)}`,
    `cuisine: ${JSON.stringify(recipe.cuisine)}`,
    `servings: ${recipe.servings}`,
    ...(recipe.prepTime != null ? [`prepTime: ${recipe.prepTime}`] : []),
    ...(recipe.cookTime != null ? [`cookTime: ${recipe.cookTime}`] : []),
    `tags: ${JSON.stringify(recipe.tags)}`,
    ...(recipe.image ? [`image: ${JSON.stringify(recipe.image)}`] : []),
    ...(recipe.imageAlt ? [`imageAlt: ${JSON.stringify(recipe.imageAlt)}`] : []),
    ...(recipe.canonical
      ? [`canonical: ${JSON.stringify(recipe.canonical)}`]
      : []),
    ...(Object.keys(ingredientAnnotations).length > 0
      ? [`ingredientAnnotations: ${JSON.stringify(ingredientAnnotations)}`]
      : []),
    "---",
  ];

  return `${frontmatter.join("\n")}\n${recipe.cookBody.trim()}\n`;
}

const OUT_DIR = path.join(process.cwd(), "out");

const hasImagesAccountHash = Boolean(
  process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH,
);

function resolveImageUrl(src: string): string | null {
  // Site-relative assets (e.g. /company-logos/foo.png) are not Cloudflare
  // Images IDs; point them at the deployed site instead
  if (src.startsWith("/")) return `${siteConfig.url}${src}`;
  if (!hasImagesAccountHash) return null;
  return getImageUrl(src, null, { width: 1200, format: "auto" });
}

const convert = (mdx: string) => mdxToAgentMarkdown(mdx, { resolveImageUrl });

interface GeneratedPage {
  /** HTML route the markdown twin belongs to, e.g. "/projects" */
  htmlPath: string;
  /** File path relative to out/, e.g. "projects.md" */
  filePath: string;
  title: string;
  description: string;
  content: string;
  facts?: [string, string][];
}

function projectFacts(project: ProjectWithADRs): [string, string][] {
  const facts: [string, string][] = [
    ["Status", project.status],
    ["Started", project.date],
  ];
  if (project.updated) facts.push(["Updated", project.updated]);
  if (project.repoUrl) facts.push(["Source code", project.repoUrl]);
  if (project.demoUrl) facts.push(["Live demo", project.demoUrl]);
  if (project.productUrl) facts.push(["Product", project.productUrl]);
  if (project.technologies.length > 0) {
    facts.push([
      "Technologies",
      project.technologies.map((tech) => tech.name).join(", "),
    ]);
  }
  return facts;
}

function buildProjectsIndexPage(
  projects: ProjectWithADRs[],
  philosophyMdx: string,
): GeneratedPage {
  const sections = [
    "## Projects",
    "",
    ...projects.flatMap((project) => {
      const adrNote =
        project.adrs.length > 0
          ? ` ${project.adrs.length} architecture decision records (ADRs) are listed on the project page.`
          : "";
      return [
        `### [${project.title}](${markdownUrl(`/projects/${project.slug}`)})`,
        "",
        `${project.description} (status: ${project.status}).${adrNote}`,
        "",
      ];
    }),
    convert(philosophyMdx).trim(),
  ];
  return {
    htmlPath: "/projects",
    filePath: "projects.md",
    title: "Projects",
    description:
      "Technical projects with architecture decision records (ADRs), plus the building philosophy that guides them. The building philosophy is included in full at the end of this page.",
    content: sections.join("\n"),
  };
}

function buildProjectPage(project: ProjectWithADRs): GeneratedPage {
  const adrSection =
    project.adrs.length > 0
      ? [
          "",
          "## Architecture Decision Records",
          "",
          ...project.adrs.map((adr) => {
            const url = markdownUrl(
              `/projects/${project.slug}/adrs/${adr.slug}`,
            );
            const inherited = adr.isInherited
              ? ` (inherited from ${adr.originProjectSlug})`
              : "";
            return `- [${adr.title}](${url}) — ${adr.status}, ${adr.date}${inherited}`;
          }),
        ]
      : [];
  return {
    htmlPath: `/projects/${project.slug}`,
    filePath: `projects/${project.slug}.md`,
    title: project.title,
    description: project.description,
    content: [convert(project.content).trim(), ...adrSection].join("\n"),
    facts: projectFacts(project),
  };
}

function buildAdrPages(project: ProjectWithADRs): GeneratedPage[] {
  return project.adrs.map((adrCard) => {
    const adr = getProjectADR(project.slug, adrCard.slug);
    const facts: [string, string][] = [
      ["Project", `${project.title} (${markdownUrl(`/projects/${project.slug}`)})`],
      ["Status", adr.status],
      ["Date", adr.date],
    ];
    if (adr.supersedes) facts.push(["Supersedes", adr.supersedes]);
    if (adr.isInherited) {
      facts.push([
        "Inherited from project",
        `${adr.originProjectSlug} (${markdownUrl(`/projects/${adr.originProjectSlug}/adrs/${adr.originAdrSlug}`)})`,
      ]);
    }
    const notes = adr.inheritedProjectNotes
      ? `\n\n## Notes for ${project.title}\n\n${convert(adr.inheritedProjectNotes).trim()}`
      : "";
    return {
      htmlPath: `/projects/${project.slug}/adrs/${adr.slug}`,
      filePath: `projects/${project.slug}/adrs/${adr.slug}.md`,
      title: adr.title,
      description: "",
      content: convert(adr.content).trim() + notes,
      facts,
    };
  });
}

function buildBlogIndexPage(
  posts: ReturnType<typeof getAllPosts>,
): GeneratedPage {
  return {
    htmlPath: "/blog",
    filePath: "blog.md",
    title: siteConfig.blog.title,
    description: siteConfig.blog.description,
    content: posts
      .flatMap((post) => [
        `### [${post.title}](${markdownUrl(`/blog/${post.slug}`)})`,
        "",
        `${post.date} · ${post.readingTime}${post.tags.length > 0 ? ` · ${post.tags.join(", ")}` : ""}`,
        "",
        post.description,
        "",
      ])
      .join("\n"),
  };
}

function buildBlogPostPages(
  posts: ReturnType<typeof getAllPosts>,
): GeneratedPage[] {
  return posts.map((post) => {
    const facts: [string, string][] = [
      ["Published", post.date],
      ["Reading time", post.readingTime],
    ];
    if (post.updated) facts.push(["Updated", post.updated]);
    if (post.tags.length > 0) facts.push(["Tags", post.tags.join(", ")]);
    if (post.canonicalUrl) facts.push(["Canonical URL", post.canonicalUrl]);
    return {
      htmlPath: `/blog/${post.slug}`,
      filePath: `blog/${post.slug}.md`,
      title: post.title,
      description: post.description,
      content: convert(post.content).trim(),
      facts,
    };
  });
}

function buildExperiencePage(): GeneratedPage {
  const sections = getAllExperience().flatMap((experience) => {
    const titles = [
      { title: experience.title, dates: formatExperienceDateRange(
        experience.previousTitles?.at(-1)?.endDate ?? experience.startDate,
        experience.endDate,
      ) },
      ...(experience.previousTitles ?? []).map((previous) => ({
        title: previous.title,
        dates: formatExperienceDateRange(previous.startDate, previous.endDate),
      })),
    ];
    return [
      `## ${experience.title} at [${experience.company}](${experience.companyUrl})`,
      "",
      `${formatExperienceDateRange(experience.startDate, experience.endDate)} · ${experience.location}`,
      "",
      ...(experience.previousTitles?.length
        ? [
            "Titles held:",
            "",
            ...titles.map((entry) => `- ${entry.title} (${entry.dates})`),
            "",
          ]
        : []),
      experience.description,
      "",
      ...experience.responsibilities.map((item) => `- ${item}`),
      "",
      experience.technologies.length > 0
        ? `Technologies: ${experience.technologies.join(", ")}\n`
        : "",
    ];
  });
  return {
    htmlPath: "/experience",
    filePath: "experience.md",
    title: "Experience",
    description: `Professional experience of ${siteConfig.name} — ${siteConfig.description}`,
    content: sections.join("\n"),
  };
}

function formatIngredient(
  item: RecipeDetailView["ingredientGroups"][number]["items"][number],
): string {
  const quantity = [item.amount, item.unit].filter(Boolean).join(" ");
  const name = quantity ? `${quantity} ${item.name}` : item.name;
  const preparation = item.preparation ? `, ${item.preparation}` : "";
  const note = item.note ? ` (${item.note})` : "";
  return `- ${name}${preparation}${note}`;
}

function buildRecipePage(recipe: RecipeDetailView): GeneratedPage {
  const facts: [string, string][] = [["Servings", String(recipe.servings)]];
  if (recipe.prepTime) facts.push(["Prep time", `${recipe.prepTime} min`]);
  if (recipe.cookTime) facts.push(["Cook time", `${recipe.cookTime} min`]);
  if (recipe.totalTime) facts.push(["Total time", `${recipe.totalTime} min`]);
  if (recipe.cuisine.length > 0) {
    facts.push(["Cuisine", recipe.cuisine.join(", ")]);
  }
  if (recipe.tags.length > 0) facts.push(["Tags", recipe.tags.join(", ")]);

  const ingredients = recipe.ingredientGroups.flatMap((group) => [
    ...(group.name ? [`### ${group.name}`, ""] : []),
    ...group.items.map(formatIngredient),
    "",
  ]);
  const cookware =
    recipe.cookware.length > 0
      ? ["## Cookware", "", ...recipe.cookware.map((item) => `- ${item}`), ""]
      : [];
  const instructions = recipe.instructions.map(
    (step, index) => `${index + 1}. ${step}`,
  );

  return {
    htmlPath: `/recipes/${recipe.slug}`,
    filePath: `recipes/${recipe.slug}.md`,
    title: recipe.title,
    description: recipe.description,
    content: [
      "## Ingredients",
      "",
      ...ingredients,
      ...cookware,
      "## Instructions",
      "",
      ...instructions,
    ].join("\n"),
    facts,
  };
}

function buildRecipesIndexPage(
  recipes: ReturnType<typeof getAllRecipes>,
): GeneratedPage {
  return {
    htmlPath: "/recipes",
    filePath: "recipes.md",
    title: "Recipes",
    description:
      "A digital recipe book with search, filtering, and kitchen-friendly features",
    content: recipes
      .flatMap((recipe) => {
        const time = recipe.totalTime ? ` · ${recipe.totalTime} min` : "";
        const cuisine =
          recipe.cuisine.length > 0 ? ` · ${recipe.cuisine.join(", ")}` : "";
        return [
          `### [${recipe.title}](${markdownUrl(`/recipes/${recipe.slug}`)})`,
          "",
          `Serves ${recipe.servings}${time}${cuisine}`,
          "",
          recipe.description,
          "",
        ];
      })
      .join("\n"),
  };
}

function buildTechnologyPages(projects: ProjectWithADRs[]): GeneratedPage[] {
  const repository = loadDomainRepository();
  // ADR slugs are only unique within a project, so collect ADRs per
  // technology from the project cards, which carry their origin project.
  // Inherited ADRs are skipped so each decision appears once, linked to
  // the project where it was made.
  const adrsByTechnology = new Map<
    string,
    { title: string; projectSlug: string; adrSlug: string }[]
  >();
  for (const project of projects) {
    for (const adr of project.adrs) {
      if (adr.isInherited) continue;
      for (const badge of adr.technologies) {
        const entries = adrsByTechnology.get(badge.slug) ?? [];
        entries.push({
          title: adr.title,
          projectSlug: project.slug,
          adrSlug: adr.slug,
        });
        adrsByTechnology.set(badge.slug, entries);
      }
    }
  }

  return getAllTechnologySlugs(repository).flatMap((slug) => {
    const tech = getTechnologyDetail(repository, slug);
    if (!tech) return [];
    const related = getRelatedContentForTechnology(repository, slug);

    const sections: string[] = [];
    if (related.projects.length > 0) {
      sections.push(
        "## Projects using this technology",
        "",
        ...related.projects.map(
          (project) =>
            `- [${project.title}](${markdownUrl(`/projects/${project.slug}`)})`,
        ),
        "",
      );
    }
    const adrs = adrsByTechnology.get(slug) ?? [];
    if (adrs.length > 0) {
      sections.push(
        "## Architecture decision records",
        "",
        ...adrs.map(
          (adr) =>
            `- [${adr.title}](${markdownUrl(`/projects/${adr.projectSlug}/adrs/${adr.adrSlug}`)})`,
        ),
        "",
      );
    }
    if (related.blogs.length > 0) {
      sections.push(
        "## Blog posts",
        "",
        ...related.blogs.map(
          (post) =>
            `- [${post.title}](${markdownUrl(`/blog/${post.slug}`)}) — ${post.date}`,
        ),
        "",
      );
    }
    if (related.roles.length > 0) {
      sections.push(
        "## Used professionally at",
        "",
        ...related.roles.map((role) => `- ${role.company} — ${role.title}`),
        "",
      );
    }

    const facts: [string, string][] = [["Website", tech.website]];
    return [
      {
        htmlPath: `/technologies/${tech.slug}`,
        filePath: `technologies/${tech.slug}.md`,
        title: tech.name,
        description: tech.description ?? "",
        content: sections.join("\n").trim() || "_No related content yet._",
        facts,
      },
    ];
  });
}

function buildHomePage(): GeneratedPage {
  return {
    htmlPath: "/",
    filePath: "index.md",
    title: siteConfig.name,
    description: siteConfig.description,
    content: [
      `Personal site of ${siteConfig.name}. Every major page has a Markdown twin: append \`.md\` to the page URL (e.g. ${markdownUrl("/projects")}). The full index is at ${siteConfig.url}/llms.txt.`,
      "",
      "## Sections",
      "",
      `- [Experience](${markdownUrl("/experience")}): career history, roles, and technologies`,
      `- [Projects](${markdownUrl("/projects")}): projects, ADRs, and building philosophy`,
      `- [Blog](${markdownUrl("/blog")}): ${siteConfig.blog.description}`,
      `- [Recipes](${markdownUrl("/recipes")}): a digital recipe book`,
      "",
      "## Links",
      "",
      `- GitHub: ${siteConfig.author.github}`,
      `- LinkedIn: ${siteConfig.author.linkedin}`,
      `- Site source code: ${siteConfig.author.sourceRepo}`,
    ].join("\n"),
  };
}

function buildLlmsTxt(
  projects: ProjectWithADRs[],
  posts: ReturnType<typeof getAllPosts>,
  recipes: ReturnType<typeof getAllRecipes>,
  technologyPages: GeneratedPage[],
): string {
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}. Personal site: projects with architecture decision records (ADRs), a building philosophy, career history, and a blog.`,
    "",
    `Every page listed below is plain Markdown. The same content is available as HTML by removing the \`.md\` suffix. All pages concatenated: ${siteConfig.url}/llms-full.txt`,
    "",
    "## Overview",
    "",
    `- [About](${markdownUrl("/")}): site overview and contact links`,
    `- [Experience](${markdownUrl("/experience")}): career history, roles, responsibilities, and technologies`,
    `- [Projects](${markdownUrl("/projects")}): all projects plus the building philosophy that guides them`,
    "",
    "## Projects",
    "",
    ...projects.map(
      (project) =>
        `- [${project.title}](${markdownUrl(`/projects/${project.slug}`)}): ${project.description}`,
    ),
    "",
    "## Architecture Decision Records",
    "",
    ...projects.flatMap((project) =>
      project.adrs
        .filter((adr) => !adr.isInherited)
        .map(
          (adr) =>
            `- [${project.title} — ${adr.title}](${markdownUrl(`/projects/${project.slug}/adrs/${adr.slug}`)})`,
        ),
    ),
    "",
    "## Blog",
    "",
    `- [Blog index](${markdownUrl("/blog")}): all posts with summaries`,
    ...posts.map(
      (post) =>
        `- [${post.title}](${markdownUrl(`/blog/${post.slug}`)}): ${post.description}`,
    ),
    "",
    "## Technologies",
    "",
    "Each page lists the projects, ADRs, blog posts, and roles using that technology.",
    "",
    ...technologyPages.map(
      (page) =>
        `- [${page.title}](${markdownUrl(page.htmlPath)})${page.description ? `: ${page.description}` : ""}`,
    ),
    "",
    "## Recipes",
    "",
    `Each recipe is also available as schema.org Recipe JSON (importable into most recipe apps): append \`.json\` to the recipe URL instead of \`.md\`.`,
    "",
    `- [Recipe index](${markdownUrl("/recipes")}): a digital recipe book`,
    ...recipes.map(
      (recipe) =>
        `- [${recipe.title}](${markdownUrl(`/recipes/${recipe.slug}`)}): ${recipe.description}`,
    ),
    "",
  ];
  return lines.join("\n");
}

/**
 * Restricts Pages Function invocations to page routes, so static assets
 * are served straight from the CDN.
 */
function buildRoutesJson(): string {
  return `${JSON.stringify(
    {
      version: 1,
      include: [
        "/api/auth/*",
        "/api/profile/*",
        "/api/households",
        "/api/households/*",
        "/api/recipes",
        "/api/recipes/*",
        "/ingest/*",
        "/",
        "/experience",
        "/projects",
        "/projects/*",
        "/blog",
        "/blog/*",
        "/recipes",
        "/recipes/*",
        "/technologies/*",
      ],
      exclude: ["/_next/*", "/company-logos/*", "/tech-icons/*"],
    },
    null,
    2,
  )}\n`;
}

/**
 * Cloudflare Pages caps _headers at 100 rules and doesn't support
 * placeholders in header values, so only the entry pages advertise their
 * Markdown twin via a Link header.
 */
function buildHeadersFile(pages: GeneratedPage[]): string {
  const entryPages = pages.filter(
    (page) => page.htmlPath.split("/").filter(Boolean).length <= 1,
  );
  const blocks = entryPages.map((page) =>
    [
      page.htmlPath,
      `  Link: <${markdownUrl(page.htmlPath)}>; rel="alternate"; type="text/markdown"`,
    ].join("\n"),
  );
  return `${blocks.join("\n")}\n`;
}

function writeFile(relativePath: string, content: string): void {
  const filePath = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main(): void {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(
      "out/ directory not found. Run `next build` first (this script runs as part of `pnpm build`).",
    );
    process.exit(1);
  }
  if (!hasImagesAccountHash) {
    console.warn(
      "NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH not set — images will be omitted from generated Markdown.",
    );
  }

  const projects = getAllProjects();
  const posts = getAllPosts();
  const philosophy = getBuildingPhilosophy();
  const recipes = getAllRecipes();
  const recipeDetails = recipes.map((recipe) => getRecipeBySlug(recipe.slug));
  const technologyPages = buildTechnologyPages(projects);

  const pages: GeneratedPage[] = [
    buildHomePage(),
    buildExperiencePage(),
    buildProjectsIndexPage(projects, philosophy),
    ...projects.map(buildProjectPage),
    ...projects.flatMap(buildAdrPages),
    buildBlogIndexPage(posts),
    ...buildBlogPostPages(posts),
    buildRecipesIndexPage(recipes),
    ...recipeDetails.map(buildRecipePage),
    ...technologyPages,
  ];

  for (const page of pages) {
    writeFile(
      page.filePath,
      renderPage(
        {
          title: page.title,
          htmlPath: page.htmlPath,
          description: page.description || undefined,
          facts: page.facts,
        },
        page.content,
      ),
    );
  }

  // Recipe twins provide machine-readable JSON and portable Cooklang source.
  for (const recipe of recipeDetails) {
    const jsonLd = buildRecipeJsonLd(
      recipe,
      siteConfig.author.name,
      `${siteConfig.url}/recipes/${recipe.slug}`,
    );
    writeFile(
      `recipes/${recipe.slug}.json`,
      `${JSON.stringify(jsonLd, null, 2)}\n`,
    );
    writeFile(`recipes/${recipe.slug}.cook`, formatCooklangExport(recipe));
  }

  writeFile("llms.txt", buildLlmsTxt(projects, posts, recipes, technologyPages));

  // The llms.txt index is deliberately not prepended: its navigation links
  // are redundant when every page is inline
  const llmsFull = pages
    .map((page) => fs.readFileSync(path.join(OUT_DIR, page.filePath), "utf-8"))
    .join("\n\n");
  writeFile("llms-full.txt", llmsFull);

  writeFile("_headers", buildHeadersFile(pages));
  writeFile("_routes.json", buildRoutesJson());

  console.log(
    `Generated ${pages.length} Markdown pages and ${recipeDetails.length} recipe JSON/Cooklang exports, llms.txt, llms-full.txt, _headers, and _routes.json in out/`,
  );
}

main();
