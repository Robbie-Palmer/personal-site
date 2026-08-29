# Blog Authoring Guide

How to write and publish blog posts for robbiepalmer.me.

## Quick start

1. Create `ui/content/blog/YYYY-MM-DD-your-post-title.mdx`
2. Add frontmatter (see [Frontmatter](#frontmatter))
3. Source and prepare an image (see [Images](#images))
4. Upload it:

   ```bash
   mise //ui:images:sync
   ```

5. Test locally with `mise //ui:dev`, then visit
   `/blog/2023-05-23-your-post-title` (the slug is the full filename)
6. Commit the `.mdx` file only. Images never enter git.

## File naming

`YYYY-MM-DD-post-title-in-kebab-case.mdx`, for example
`2023-05-23-automatically-detect-pii-real-time-cyber-defense.mdx`. The date is
the publication date; the URL slug is the full filename without the extension.

Image filenames use CalVer (`{name}-YYYY-MM-DD.{ext}`) so the version history is
obvious from the name alone, without needing git history. One local version per
image: when you update an image, delete the old file and use a newer date.
Old versions stay in Cloudflare for rollback.

## Frontmatter

```yaml
---
title: "Your Post Title"
description: "A concise summary for SEO and social media previews (140-160 chars)"
date: "YYYY-MM-DD"
tags: ["tag1", "tag2", "tag3"]
image: "blog/image-name-YYYY-MM-DD"
imageAlt: "Descriptive alt text for accessibility and SEO"
updated: "YYYY-MM-DD"  # optional, if significantly updated
canonical: "https://original-publication-url.com/article"  # optional, for republishes
---
```

| Field         | Required | Format                   | Notes                                    |
| ------------- | -------- | ------------------------ | ---------------------------------------- |
| `title`       | Yes      | Any                      | Used in `<h1>`, SEO, OpenGraph           |
| `description` | Yes      | 140-160 chars            | Meta description, social previews        |
| `date`        | Yes      | `YYYY-MM-DD`             | Publication date                         |
| `tags`        | Yes      | Lowercase, hyphenated    | Array format                             |
| `image`       | Yes      | `blog/{name}-YYYY-MM-DD` | Cloudflare Images ID, no extension       |
| `imageAlt`    | Yes      | Descriptive text         | Screen readers, fallback if image fails  |
| `updated`     | No       | `YYYY-MM-DD`             | Shows an "Updated" badge                 |
| `canonical`   | No       | Full URL                 | For content republished from other sites |

Validation runs at build time and fails the build with a descriptive error:

```text
Error: Post 2023-05-23-my-post is missing required field: imageAlt
```

## Images

### Requirements

| Requirement  | Specification          |
| ------------ | ---------------------- |
| Dimensions   | Minimum 1200px wide    |
| Aspect ratio | ~2:1 to 16:9 landscape |
| File size    | Under 5MB              |
| Format       | JPG, PNG, WebP, or GIF |

Aim for 1200x630 (the OpenGraph standard) or 1920x1080. Cloudflare converts
uploads to WebP/AVIF and scales down, never up.

[Unsplash](https://unsplash.com/) and [Pexels](https://www.pexels.com/) are
free for commercial use without attribution; still check the specific photo's
license.

### Workflow

1. Save the image to `ui/source-images/blog/` as
   `{descriptive-name}-YYYY-MM-DD.{ext}` (kebab-case, lowercase, one version).
2. Upload from the repo root:

   ```bash
   mise //ui:images:sync
   ```

   The script validates CalVer naming, rejects versions older than what
   Cloudflare already has, uploads only new images, and skips existing ones.
3. Reference the image ID in frontmatter. Include the `blog/` prefix and date,
   omit the extension:

   ```yaml
   image: "blog/automatically-detect-pii-real-time-cyber-defense-featured-2025-12-14"
   ```

`ui/source-images/` is gitignored; Cloudflare Images is the store.

For images inside the post body, use the same ID form in an `<img>` tag:

```mdx
<img src="blog/diagram-architecture-2025-12-14" alt="System architecture diagram" />
```

The image resolves from Cloudflare with responsive srcsets.

### Alt text

Alt text serves screen readers, search engines, and anyone whose connection
drops the image. Describe the content in about 10-20 words, mention any text
inside the image, and give context relevant to the post. Never write just
"Image", stuff keywords, or repeat the surrounding paragraph; screen readers
cut off around 125 characters.

```yaml
# Good
imageAlt: "A phone locked down with a fingerprint reader and surrounded by shields / padlocks"

# Bad
imageAlt: "Image of security"
```

More: [W3C alt text tutorial](https://www.w3.org/WAI/tutorials/images/),
[WebAIM alternative text](https://webaim.org/techniques/alttext/).

## Republished content

Set the `canonical` frontmatter field to the original URL, and note it at the
top of the post:

```markdown
***

**Note:** Originally published on [Platform Name](url). Republished here as part of my writing portfolio.

***
```

## Testing locally

Run `mise //ui:dev` and check your post at
`http://localhost:3000/blog/{slug}`:

- It appears in the blog list at `/blog`.
- The hero image loads and title/description/tags render.
- Formatting, code blocks, tables, and body images all render.
- The layout holds up at mobile width in DevTools.

After deploying, check social previews per the
[social preview runbook](../../../docs/social-previews.md).

Before pushing, run `mise //ui:check` and `mise //ui:build`.

## Troubleshooting

**Post build fails on frontmatter.** The error names the problem: missing
field, invalid date, image ID missing its CalVer date or carrying a file
extension, tags not in array form. Fix the frontmatter accordingly.

**Image 404s.** Either the upload never happened, the frontmatter ID is wrong,
or the ID includes an extension. Diagnose with:

```bash
mise //ui:images:health-check
mise //ui:images:sync
```

**Version validation fails on upload.**

```text
Latest existing version: 2025-11-30
New version: 2025-11-27
```

Use a newer date than the latest existing version, or delete the old version
in Cloudflare first.

**Invalid filename on upload.** The name must be
`{name}-YYYY-MM-DD.{ext}`; rename the file.

**Dev server won't start.** Clear caches and reinstall:

```bash
mise //ui:clean
mise //ui:install
mise //ui:dev
```

## Resources

- [MDX documentation](https://mdxjs.com/)
- [OpenGraph debugger](https://www.opengraph.xyz/)
