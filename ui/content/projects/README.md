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

The `role` field is optional and links a project to a job role where it was created. The value should be the slug of the job role (normalized company name). For example:

- `"terminal-industries"` for Terminal Industries
- `"bestomer"` for Bestomer
- `"confluent"` for Confluent

When specified, the role will be displayed as a badge on the project card and detail page, linking to the experience page.

## ADR Format

ADRs are standard MDX files in the `adrs/` subdirectory. The filename should be numbered (e.g., `001-decision-name.mdx`).

**Frontmatter:**

```yaml
---
title: "ADR Title"
status: "Accepted" # "Proposed" | "Accepted" | "Rejected" | "Deprecated"
date: "YYYY-MM-DD"
---
```
