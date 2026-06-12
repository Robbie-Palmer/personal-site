# Project Guide for Claude

## Build System

This project uses **mise** for all build and development tasks.

### Important mise Usage

- **List all tasks**: `mise task --all`
- **Run tasks in sub-projects**: Use the `//:` prefix
  - Example: `mise //:task-name`
  - This is required because we're using an experimental mono-repo feature
  - See: <https://github.com/jdx/mise/discussions/6564>

### Common Commands

Always use mise instead of direct package manager commands:

- DON'T use `npm run`, `pnpm run`, etc.
- DO use `mise //:task-name` or `mise task --all` to discover available tasks

## Project Structure

This is a mono-repo containing:

- `ui/` - Next.js frontend application
- `infra/` - Infrastructure as code (Terraform: Cloudflare + Neon)
- Root `package.json` - Generic dev tooling only

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui
- **Content**: MDX for blog posts
- **Infrastructure**: Cloudflare Pages
- **Tooling**: Biome (linting/formatting), Husky (pre-commit hooks)

## Agent-Friendly Markdown

Every major page has a plain-Markdown twin at the same URL with a `.md`
suffix (e.g. `/projects.md`), indexed at `/llms.txt` (and concatenated in
`/llms-full.txt`). These are generated into `out/` by
`ui/scripts/generate-agent-markdown.ts`, which runs as part of `pnpm build`
after `next build`. The MDX-to-Markdown conversion lives in
`ui/lib/content/agent-markdown.ts`. A Pages Function middleware
(`functions/_middleware.ts`) additionally serves Markdown from canonical
page URLs via content negotiation (`Accept: text/markdown` or agent user
agents), scoped by the generated `out/_routes.json`.

## When Mise Is Not Available

If mise is not installed in your environment, run equivalent commands directly from the `ui/` directory:

```bash
cd ui
pnpm install                  # Install dependencies
pnpm typecheck                # Type checking (run after install)
pnpm lint                     # Lint with Biome
pnpm format                   # Format with Biome
pnpm test                     # Run unit tests
```

For the **build command**, you must set an environment variable (see below):

```bash
NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=placeholder pnpm build
```

## Environment Variables

### Required for Build: `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`

The build requires this env var for Cloudflare Images URL construction. It's validated at build time.

- **For verification builds** (just checking the build works): Use any non-empty value
- **For production/CI**: Must be the real Cloudflare account hash

```bash
# Quick build verification (any value works)
NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=placeholder pnpm build
```
