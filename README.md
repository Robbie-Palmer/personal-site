# personal-site

Personal website with blog and interactive resume.

**Live:** robbiepalmer.me (coming soon)

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Content:** MDX with frontmatter
- **Infrastructure:** Terraform + Cloudflare Pages
- **Tools:** mise (Node LTS, pnpm, Terraform)

## Setup

```bash
# Install mise (one-time)
curl https://mise.run | sh

# mise auto-installs tools and dependencies
mise run install

# Start dev server
mise run dev
```

Visit http://localhost:3000

## Commands

```bash
mise tasks    # List all available commands
```

## Structure

```
ui/          Next.js application
infra/       Terraform (Cloudflare Pages, DNS)
.github/     CI/CD workflows
```
