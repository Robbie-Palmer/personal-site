# personal-site

Personal website with blog and interactive resume.

**Live:** robbiepalmer.me (coming soon)

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Content:** MDX with frontmatter
- **Infrastructure:** Terraform + Cloudflare Pages
- **Tools:** mise (Node LTS, pnpm, Terraform)

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

## Commands

This project uses mise's **monorepo tasks** feature for managing tasks across multiple projects.

```bash
# List all available tasks
mise tasks --all

# Run tasks from anywhere using full path
mise //ui:dev              # Example: start dev server
mise //infra:format        # Example: format Terraform files

# Or run from within a project directory
cd ui && mise :dev         # Shorter syntax when in the directory
```

**Note:** This project requires mise's experimental monorepo feature.
The `MISE_EXPERIMENTAL=1` env var is configured in `.mise.toml` and loaded automatically when you activate mise.

## Pre-commit Hooks

Automatic linting and formatting runs on commit. See:

- `.husky/pre-commit` - Hook entry point
- `package.json` (`lint-staged`) - File patterns and commands
- `.mise.toml` - Task definitions (single source of truth for all tooling)
- `.markdownlint.json`, `.yamllint` - Linter configurations

## Structure

```text
ui/          Next.js application
infra/       Terraform (Cloudflare Pages, DNS)
.github/     CI/CD workflows
```
