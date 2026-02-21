# Project Authoring Guide

This directory contains the content for the "Projects" section of the site.

## Directory Structure

Each project is a subdirectory named after its slug (e.g., `personal-site`). Inside each directory:

1. `index.mdx`: The main project content and metadata (in frontmatter).
2. `adrs/`: A directory containing Architecture Decision Records (ADRs) as `.mdx` files.

Example:

```text
content/projects/
└── personal-site/
    ├── index.mdx
    └── adrs/
        ├── 001-monorepo.mdx
        └── 002-rendering-strategy.mdx
```

## Project Metadata (index.mdx)

Define metadata in the frontmatter of `index.mdx`:

```yaml
---
title: "Project Title"
description: "Short description for cards and SEO."
date: "2025-11-02"
updated: "2025-12-15" # Optional
tech_stack:
  - "Next.js"
  - "TypeScript"
  - "Tailwind CSS"
repo_url: "https://github.com/..." # Optional
demo_url: "https://demo..." # Optional
role: "terminal-industries" # Optional - link to job role slug
---

# Overview

Write your project overview here using MDX...
```

### Role Field

The `role` field is optional and links a project to a job role where it was created. The value should be the
slug of the job role (normalized company name). For example:

- `"terminal-industries"` for Terminal Industries
- `"bestomer"` for Bestomer
- `"confluent"` for Confluent

When specified, the role will be displayed as a badge on the project card and detail page, linking to the
specific job role on the experience page.

### Inheriting ADRs

Projects inherit ADRs by creating explicit stub files inside the project's `adrs/` directory.
This keeps inherited and local decisions interleaved in the same ordered index space.

Example inherited stub:

```yaml
---
inherits_from: "personal-site:002-react"
---
```

Rules:

- Inherited stubs are derived from source ADR content and metadata.
- Inherited stubs may include markdown body content as project-specific notes.
- `inherits_adrs` in project frontmatter is deprecated, and forbidden.
- Use ADR-level `supersedes` only when replacing an inherited decision.
- `supersedes` should reference ADRs in the current project's ADR context.

Inherited ADRs are rendered inside the child project's ADR routes (`/projects/{child}/adrs/{slug}`) with
child-context numbering. The detail page shows source-project attribution, a summary of the source ADR,
and any project-specific notes from the stub file body.

Note: ADR slugs must be unique within a project's effective ADR context (local + inherited). Duplicate slugs
in a single project context fail validation.

## ADR Format

ADRs are standard MDX files in the `adrs/` subdirectory. The filename should be numbered (e.g., `001-decision-name.mdx`).

**Frontmatter:**

```yaml
---
title: "ADR Title"
status: "Accepted" # "Proposed" | "Accepted" | "Rejected" | "Deprecated"
date: "YYYY-MM-DD"
supersedes: "project-slug:adr-slug" # Optional, e.g. "personal-site:013-dependabot"
---
```
