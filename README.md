# personal-site

Personal website with blog and interactive resume.

**Live:** [robbiepalmer.me](https://robbiepalmer.me)

## Tech Stack

### Frontend

- **Framework:** Next.js 15 (App Router, Static Export)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Components:** shadcn/ui
- **UI Library:** React 19

### Content

- **Format:** MDX with strict frontmatter validation
- **Blog Posts:** Located in `ui/content/blog/` ([authoring guide](ui/content/blog/README.md))
- **Projects:** Located in `ui/content/projects/` ([authoring guide](ui/content/projects/README.md))
- **Images:** Cloudflare Images with CalVer versioning (YYYY-MM-DD)

### Infrastructure

- **Hosting:** Cloudflare Pages
- **CDN & Images:** Cloudflare Images (automatic WebP/AVIF conversion, responsive)
- **DNS:** Cloudflare DNS
- **IaC:** Terraform with Terraform Cloud remote state ([workspace](https://app.terraform.io/app/robbie-palmer/workspaces/personal-site))

### Development Tools

- **Task Runner:** [mise](https://mise.jdx.dev/) with [monorepo tasks](https://mise.jdx.dev/tasks/monorepo.html) (see `.mise.toml`)
- **Linting:** Biome (TypeScript/JavaScript), markdownlint (Markdown), remark (MDX), yamllint (YAML)
- **Formatting:** Biome
- **Type Checking:** TypeScript
- **Pre-commit:** Husky + lint-staged
- **Performance QA:** [Lighthouse](https://developer.chrome.com/docs/lighthouse) (via `mise //ui:lighthouse:serve`)
- **Dependency Management:** Renovate (automated PRs)
- **Code Review:** [CodeRabbit](https://coderabbit.ai/) (AI-powered PR reviews)
- **Project Management:** Shortcut (see [ADR 034](ui/content/projects/personal-site/adrs/034-shortcut.mdx))
- **AI Pair Programming:** Claude (see [claude.md](claude.md) for agent guide)

## Setup

1. Install mise (one-time)

   ```bash
   curl https://mise.run | sh
   ```

2. Add mise to your shell config (one-time)

   ```bash
   echo 'eval "$(mise activate bash)"' >> ~/.bashrc  # or ~/.zshrc for zsh
   source ~/.bashrc  # reload your shell
   ```

3. Clone and enter the project directory

   ```bash
   cd personal-site
   ```

4. Install dependencies

   ```bash
   mise //ui:install
   ```

5. Start dev server

   ```bash
   mise //ui:dev
   ```

Visit [http://localhost:3000](http://localhost:3000)

## Repository Structure

```text
personal-site/
├── .github/          # CI/CD workflows, issue templates
│   └── workflows/    # UI CI, Infra CI/CD
├── .claude/          # AI agent config
│   └── commands/     # Custom Claude slash commands
├── infra/            # Infrastructure as Code
│   └── cloudflare/   # Terraform configs for Cloudflare Pages, DNS
├── ui/               # Next.js application
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   ├── content/      # Content files
│   │   └── blog/     # Blog posts in MDX (see authoring guide)
│   ├── lib/          # Shared utilities and config
│   ├── public/       # Static assets (fonts, tech icons, etc. - blog post images use Cloudflare Images)
│   ├── scripts/      # Utility scripts (image sync, health checks)
│   └── tests/        # Vitest tests
├── .mise.toml        # Root mise config (repo-wide tasks)
├── package.json      # Root package (repo-wide dev tooling)
└── docs/             # Private technical documentation
```

## Commands

This project uses mise's **monorepo tasks** feature for managing tasks across multiple projects.

### UI Development

```bash
mise //ui:dev              # Start dev server
mise //ui:build            # Build for production
mise //ui:check            # Run all checks (lint, format, typecheck, test)
mise //ui:test             # Run tests
mise //ui:test:watch       # Run tests in watch mode
```

### Linting & Formatting

```bash
mise //:lint                  # Lint all files (Markdown, MDX, YAML, TypeScript)
mise //:lint:markdown         # Lint Markdown files
mise //:lint:mdx              # Lint MDX files
mise //:lint:yaml             # Lint YAML files
mise //ui:lint                # Lint TypeScript/JavaScript
mise //ui:format              # Format and fix with Biome
```

### Infrastructure Tasks

```bash
mise //infra/cloudflare:format  # Format Terraform files
mise //infra/cloudflare:lint    # Lint Terraform files
```

### Content Management

```bash
mise //ui:images:sync         # Upload blog images to Cloudflare Images
mise //ui:images:health-check # Validate Cloudflare Images setup
```

**List all tasks:**

```bash
mise tasks --all
```

**Learn more:** [mise monorepo tasks documentation](https://mise.jdx.dev/tasks/monorepo.html)

## Testing & QA Workflow

This project has multiple levels of testing, from local development to production-like previews:

### 1. Local Development (Browser)

Run the dev server with hot module replacement for rapid iteration:

```bash
mise //ui:dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser. Changes to code will hot-reload automatically.

### 2. Mobile Device Testing (Local Network)

Test on real mobile devices connected to the same network:

```bash
mise //ui:dev:qr
```

This displays a QR code you can scan with your phone to open the dev server. Useful for testing
responsive layouts, touch interactions, and mobile-specific behavior on actual devices.

### 3. Automated Checks (CI)

When you open a pull request, GitHub Actions automatically runs:

- **Build:** `next build` - ensures the static export compiles
- **Lint:** Biome, markdownlint, remark, yamllint
- **Type Check:** TypeScript strict mode
- **Tests:** Vitest unit and integration tests

All checks must pass before merging.

### 4. Preview Deployments (Cloudflare)

Every PR automatically gets a preview deployment on Cloudflare Pages. This lets you test on real
production infrastructure before merging:

- Full static build deployed to Cloudflare's edge network
- Production-like environment (CDN, headers, routing)
- Shareable URL for team review

Preview URLs appear as a comment on the PR once the deployment completes.

### 5. Performance Testing (Lighthouse)

Run Lighthouse audits to catch performance regressions:

```bash
# Against local build (builds, serves, and runs Lighthouse)
mise //ui:lighthouse:serve

# Against preview deployment
LIGHTHOUSE_URL=https://preview-abc123.personal-site.pages.dev mise //ui:lighthouse

# Against production (as baseline for comparison)
LIGHTHOUSE_URL=https://robbiepalmer.me mise //ui:lighthouse
```

Compare scores across environments to catch regressions before they reach production.

## Pre-commit Hooks

Automatic linting and formatting runs on commit. See:

- `.husky/pre-commit` - Hook entry point
- `package.json` (`lint-staged`) - File patterns and commands
- `.mise.toml` - Task definitions (single source of truth for all tooling)
- `.markdownlint.json`, `.yamllint` - Linter configurations

## Writing Blog Posts

New blog post authors should read the **[Blog Authoring Guide](ui/content/blog/README.md)** which covers:

- Frontmatter format specification
- Image sourcing and optimization guidelines
- How to sync images to Cloudflare Images
- Alt text best practices
- Local testing workflow

## Deployment

### UI Deployment

- **Platform:** Cloudflare Pages
- **Trigger:** Automatic on push to `main`
- **Preview Deployments:** Automatic on pull requests
- **Build:** GitHub Actions builds and Cloudflare Pages deploys
- **Secrets:** Loaded from GitHub environment variables (configured in Terraform)
- **Dashboard:** [Cloudflare Pages Dashboard](https://dash.cloudflare.com/) → Your Account → Workers & Pages → personal-site

### Infrastructure Changes

- **Tool:** Terraform with Terraform Cloud remote state
- **Secrets:** Loaded from GitHub environment variables (Cloudflare API tokens, etc.)
- **Workflow:**
  1. PR opened → CI runs `terraform plan`, posts plan as PR comment
  2. PR merged to `main` → CD automatically runs `terraform apply`
- **Workspace:** [Terraform Cloud](https://app.terraform.io/app/robbie-palmer/workspaces/personal-site)

## Manual QA

### Testing Social Media Previews (OpenGraph/Twitter Cards)

Blog posts include OpenGraph and Twitter Card metadata for rich social media previews.
These require manual testing since preview generation happens on external platforms:

**Testing Tools:**

- **Open Graph Debugger**: <https://www.opengraph.xyz/> (shows previews for Twitter/X, LinkedIn, Facebook, WhatsApp, Discord)
- **Alternative**: Post URL in a draft tweet/post to see live preview on the actual platform

**What to verify:**

- Images display correctly (1200x630px for OG)
- Title, description, and alt text appear
- Correct card type (summary_large_image for Twitter)
- No broken images or missing metadata

**When to test:**

- After updating blog post featured images
- After changing site metadata configuration

## External Links

### Dashboards

- [Cloudflare Pages](https://dash.cloudflare.com/) → Workers & Pages → personal-site
- [Cloudflare Images](https://dash.cloudflare.com/) → Images
- [Cloudflare DNS](https://dash.cloudflare.com/) → Websites → robbiepalmer.me → DNS
- [Terraform Cloud Workspace](https://app.terraform.io/app/robbie-palmer/workspaces/personal-site)
- [GitHub Repository](https://github.com/RobbiePalmer/personal-site)

### Documentation

- [mise documentation](https://mise.jdx.dev/)
- [mise monorepo tasks](https://mise.jdx.dev/tasks/monorepo.html)
- [Next.js documentation](https://nextjs.org/docs)
- [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Images documentation](https://developers.cloudflare.com/images/)
- [Terraform documentation](https://www.terraform.io/docs)
- [Lighthouse documentation](https://developer.chrome.com/docs/lighthouse)
- [CodeRabbit documentation](https://docs.coderabbit.ai/)

## AI Coding Agent Guide

If you're an AI coding agent (like Claude), read **[claude.md](claude.md)** for:

- Build system details (mise usage)
- Project structure and conventions
- Coding patterns and best practices

## Contributing

### Quality Gates

All PRs must pass:

- Linting (Biome, markdownlint, remark, yamllint)
- Type checking (TypeScript)
- Tests (Vitest)
- Build (Next.js static export)
- Terraform validation (if infra changed)

### Code Review

- **CodeRabbit:** Automated AI reviews on all PRs
- **Manual Review:** By repository owner
