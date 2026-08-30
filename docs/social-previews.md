# Social preview QA

Blog posts ship OpenGraph and Twitter Card metadata for rich social media
previews. Preview generation happens on external platforms, so this cannot be
covered by automated tests. Verify it manually before merging changes.

## When to test

- After updating a post's featured image or other frontmatter metadata.
- After changing site metadata configuration (head helpers, layout templates,
  SEO utilities).

## How to test

Run the checks against whichever environment carries the change, a PR preview
deployment (see [preview environments](preview-environments.md)) or production.

Tools:

- [Open Graph Debugger](https://www.opengraph.xyz/) shows previews for
  Twitter/X, LinkedIn, Facebook, WhatsApp, and Discord in one place.
- Alternatively, paste the URL into a draft tweet or post and inspect the live
  preview on the actual platform.

## What to verify

- Featured image renders at the correct size (1200×630 for OG).
- Title, description, and alt text appear as written.
- Correct card type (`summary_large_image` for Twitter).
- No broken images or missing metadata.

Image sourcing and sizing rules live in the
[blog authoring guide](../ui/content/blog/README.md).
