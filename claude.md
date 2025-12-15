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
- `infra/cloudflare/` - Cloudflare infrastructure (Terraform)
- Root `package.json` - Generic dev tooling only

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui
- **Content**: MDX for blog posts
- **Infrastructure**: Cloudflare Pages
- **Tooling**: Biome (linting/formatting), Husky (pre-commit hooks)
