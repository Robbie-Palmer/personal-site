# Blog Authoring Guide

This guide covers everything you need to write and publish blog posts for robbiepalmer.me.

## Quick Start

1. **Create your post** in `ui/content/blog/`:

   ```bash
   touch ui/content/blog/YYYY-MM-DD-your-post-title.mdx
   ```

2. **Add frontmatter** (see [Frontmatter Format](#frontmatter-format))

3. **Source and prepare images** (see [Image Guidelines](#image-guidelines))

4. **Upload images** to Cloudflare Images:

   ```bash
   mise //ui:images:sync
   ```

5. **Test locally:**

   ```bash
   mise //ui:dev
   ```

   Visit <http://localhost:3000/blog/your-post-title>

6. **Commit and push** (only code, not images!)

## File Naming Convention

Format: `YYYY-MM-DD-post-title-in-kebab-case.mdx`

**Examples:**

- `2023-05-23-automatically-detect-pii-real-time-cyber-defense.mdx`
- `2020-07-25-why-you-should-not-buy-a-house.mdx`

**Rules:**

- Date must be publication date (YYYY-MM-DD format)
- Title in lowercase, hyphen-separated (kebab-case)
- Must end in `.mdx`
- No spaces or special characters

The URL slug is derived from the full filename (e.g., `/blog/2023-05-23-automatically-detect-pii-real-time-cyber-defense`).

## Frontmatter Format

### Required Fields

```yaml
---
title: "Your Post Title"
description: "A concise summary for SEO and social media previews (140-160 chars)"
date: "YYYY-MM-DD"
tags: ["tag1", "tag2", "tag3"]
image: "blog/image-name-YYYY-MM-DD"
imageAlt: "Descriptive alt text for accessibility and SEO"
---
```

### Optional Fields

```yaml
---
# ... required fields ...
updated: "YYYY-MM-DD"  # If post has been significantly updated
canonical: "https://original-publication-url.com/article"  # If republished from elsewhere
---
```

### Field Specifications

| Field        | Type   | Required | Format                   | Notes                                    |
|--------------|--------|----------|--------------------------|------------------------------------------|
| `title`      | string | ✅       | Any                      | Used in `<h1>`, SEO, OpenGraph           |
| `description`| string | ✅       | 140-160 chars            | Meta description, social previews        |
| `date`       | string | ✅       | `YYYY-MM-DD`             | Publication date, must be valid          |
| `tags`       | array  | ✅       | `["tag1", "tag2"]`       | Lowercase, hyphen-separated              |
| `image`      | string | ✅       | `blog/{name}-YYYY-MM-DD` | Cloudflare Images ID (no extension!)     |
| `imageAlt`   | string | ✅       | Descriptive              | Screen reader text, shown if image fails |
| `updated`    | string | ❌       | `YYYY-MM-DD`             | Shows "Updated: {date}" badge            |
| `canonical`  | string | ❌       | Full URL                 | For content republished from other sites |

### Validation

Strict validation runs at build time. Invalid frontmatter will **fail the build** with a clear error message.

**Common mistakes:**

- ❌ Missing required field → Build fails
- ❌ Invalid date format → Build fails
- ❌ Image ID without CalVer date → Build fails
- ❌ Image ID with file extension → Build fails
- ❌ Tags not in array format → Build fails

**Valid example:**

```yaml
---
title: "How To Automatically Detect PII for Real-Time Cyber Defense"
description: "Using machine learning-powered PII detection to enable advanced SIEM, SOAR, and analytics use cases."
date: "2023-05-23"
tags: ["data-governance", "cybersecurity", "machine-learning"]
image: "blog/automatically-detect-pii-real-time-cyber-defense-featured-2025-12-14"
imageAlt: "A phone locked down with a fingerprint reader and surrounded by shields / padlocks"
canonical: "https://www.confluent.io/blog/pii-detection-real-time-cyber-defense/"
---
```

## Image Guidelines

### Image Sourcing

#### Where to Find Images

**Free Stock Photo Sites:**

- [Unsplash](https://unsplash.com/) - High-quality, free photos
- [Pexels](https://www.pexels.com/) - Free stock photos and videos

**Search Tips:**

- Be specific: "data security lock" not just "security"
- Try related terms: "analytics dashboard", "data visualization", "technology concept"
- Filter by orientation: Landscape for hero images
- Look for images with space for text overlays (if needed)

**Licensing:**

- Unsplash/Pexels photos are free for commercial use
- No attribution required (but appreciated!)
- Always check the license on the specific photo

#### Image Requirements

| Requirement        | Specification                 | Notes                                                         |
|--------------------|-------------------------------|---------------------------------------------------------------|
| **Dimensions**     | Minimum 1200px wide           | Cloudflare Images will scale down, never up                   |
| **Aspect Ratio**   | ~2:1 to 16:9 (landscape)      | Works best for hero images and OpenGraph                      |
| **File Size**      | < 5MB                         | Cloudflare Images accepts up to 10MB, but keep reasonable     |
| **Format**         | JPG, PNG, WebP, GIF           | Cloudflare auto-converts to WebP/AVIF                         |
| **Content**        | High contrast, clear subject  | Will be displayed at various sizes                            |

**Recommended:** 1200x630px (OpenGraph standard) or 1920x1080px (common hero size)

### Image Workflow

#### 1. Download and Name Image

Save to `ui/source-images/blog/` with **CalVer naming:**

**Format:** `{descriptive-name}-YYYY-MM-DD.{ext}`

**Examples:**

- `automatically-detect-pii-real-time-cyber-defense-featured-2025-12-14.jpg`
- `post-modern-management-featured-2025-12-14.jpg`
- `pii-udfs-1-2025-12-14.png`

**Rules:**

- Name describes the image content (kebab-case)
- Date is when you're adding/updating the image (YYYY-MM-DD)
- Lowercase letters, numbers, hyphens only
- Valid extensions: jpg, jpeg, png, gif, webp
- One version per image locally (delete old versions)

#### 2. Upload to Cloudflare Images

From the project root:

```bash
mise //ui:images:sync
```

This script:

- ✅ Validates CalVer naming format
- ✅ Checks for duplicate root names locally
- ✅ Validates version ordering against Cloudflare
- ✅ Uploads only new images
- ✅ Skips already-uploaded images

**Note:** `ui/source-images/` is gitignored. Images live in Cloudflare, not git.

#### 3. Reference in Frontmatter

Use the image ID (filename without extension) in frontmatter:

```yaml
image: "blog/automatically-detect-pii-real-time-cyber-defense-featured-2025-12-14"
```

**Important:**

- Include the `blog/` prefix
- Include the CalVer date
- Do NOT include file extension (.jpg, .png, etc.)

### Alt Text Best Practices

Alt text is crucial for:

- **Accessibility:** Screen readers for visually impaired users
- **SEO:** Search engines index alt text
- **Fallback:** Shown if image fails to load

**Good alt text:**

- ✅ Describes the image content concisely (10-20 words)
- ✅ Provides context relevant to the post
- ✅ Mentions important text in the image
- ✅ Is useful if you can't see the image

**Bad alt text:**

- ❌ "Image" or "Photo"
- ❌ Keyword stuffing
- ❌ Too long (screen readers cut off after ~125 chars)
- ❌ Redundant with surrounding text

**Examples:**

```yaml
# Good
imageAlt: "A phone locked down with a fingerprint reader and surrounded by shields / padlocks"

# Bad
imageAlt: "Image of security"  # Too vague
imageAlt: "PII data governance cybersecurity machine learning SIEM SOAR"  # Keyword stuffing
```

**Resources:**

- [W3C Alt Text Guidelines](https://www.w3.org/WAI/tutorials/images/)
- [WebAIM Alternative Text](https://webaim.org/techniques/alttext/)

### Updating Images

To update an existing image:

1. **Save new version** with updated CalVer date:

   ```text
   Old: ui/source-images/blog/hero-image-2025-11-27.jpg
   New: ui/source-images/blog/hero-image-2025-12-15.jpg
   ```

2. **Delete old version** from `ui/source-images/blog/` (keep only latest locally)

3. **Upload new version:**

   ```bash
   mise //ui:images:sync
   ```

4. **Update frontmatter** to reference new version:

   ```yaml
   image: "blog/hero-image-2025-12-15"
   ```

**Note:** Old versions persist in Cloudflare for rollback capability.

## Writing Content

### MDX Features

MDX allows you to use React components in Markdown:

```mdx
# Regular Markdown

This is regular markdown text with **bold** and *italic*.

## Lists work too

- Item 1
- Item 2
- Item 3

## Code blocks with syntax highlighting

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\`

## GitHub Flavored Markdown

- [x] Task lists work
- [ ] Strikethrough with ~~text~~
- Tables are supported

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
```

### Referencing Images in Content

For images within the post body (not the hero image):

```mdx
<img
  src="blog/diagram-architecture-2025-12-14"
  alt="System architecture diagram showing microservices"
/>
```

The image will be automatically resolved from Cloudflare Images with responsive srcsets.

**Best practices:**

- Use semantic alt text
- Keep images relevant to the surrounding content
- Consider mobile display (images will scale)

### Republished Content Pattern

If republishing content from another site, include both the `canonical` frontmatter field and a note at the top of the post:

```yaml
---
canonical: "https://www.confluent.io/blog/pii-detection-real-time-cyber-defense/"
---
```

```markdown
***

**📝 Note:** Originally published on [Platform Name](url). Republished here as part of my writing portfolio.

***
```

## Testing Locally

### 1. Start the Development Server

```bash
mise //ui:dev
```

Visit <http://localhost:3000>

### 2. Navigate to Your Post

URL format: `http://localhost:3000/blog/{slug}`

Where `{slug}` is your full filename without `.mdx`:

- File: `2023-05-23-automatically-detect-pii-real-time-cyber-defense.mdx`
- URL: `http://localhost:3000/blog/2023-05-23-automatically-detect-pii-real-time-cyber-defense`

### 3. Check These Items

- [ ] Post appears in the blog list (<http://localhost:3000/blog>)
- [ ] Hero image loads correctly
- [ ] Title and description display properly
- [ ] Tags appear at the bottom
- [ ] Content renders correctly (formatting, code blocks, tables)
- [ ] All images in the post body load
- [ ] Reading time estimate is reasonable
- [ ] Mobile responsive layout (test in browser DevTools)

### 4. Test Social Media Previews (Optional)

**After deploying to production**, test OpenGraph/Twitter Cards:

- [OpenGraph Debugger](https://www.opengraph.xyz/) - Shows previews for Twitter/X, LinkedIn, Facebook, etc.
- Check that the 1200x630px hero image displays correctly
- Verify title, description, and alt text

## Publishing Workflow

### Before You Push

1. **Validate your post:**

   ```bash
   mise //ui:check  # Runs linting, formatting, type checking, tests
   ```

2. **Build to catch errors:**

   ```bash
   mise //ui:build
   ```

3. **Review changes:**

   ```bash
   git status
   git diff
   ```

**Remember:** Only commit the `.mdx` file, NOT images! Images are gitignored and live in Cloudflare.

### Git Workflow

```bash
# Create a branch
git checkout -b blog/your-post-title

# Add your post
git add ui/content/blog/YYYY-MM-DD-your-post-title.mdx

# Commit
git commit -m "Add blog post: Your Post Title"

# Push
git push origin blog/your-post-title

# Create a pull request on GitHub
```

### Deployment

1. **PR Review:** CodeRabbit will automatically review your PR
2. **CI Checks:** GitHub Actions will run linting, type checking, and build
3. **Preview:** Cloudflare Pages creates a preview deployment for your PR
4. **Merge:** Once approved and checks pass, merge to `main`
5. **Auto-Deploy:** Cloudflare Pages automatically deploys on push to `main`

Your post will be live at `https://robbiepalmer.me/blog/{slug}` within a few minutes!

## Troubleshooting

### Build Fails: Invalid Frontmatter

**Error messages are descriptive.** Example:

```text
Error: Post 2023-05-23-my-post is missing required field: imageAlt
```

**Solution:** Add the missing field to your frontmatter.

### Image Not Found (404)

**Causes:**

1. Image not uploaded to Cloudflare Images
2. Wrong image ID in frontmatter
3. Image ID includes file extension (should not!)

**Debug:**

```bash
# Check Cloudflare Images
mise //ui:images:health-check

# Re-upload images
mise //ui:images:sync
```

### Image Upload Fails

#### Error: Version validation failed

```text
Latest existing version: 2025-11-30
New version: 2025-11-27
```

**Solution:** Use a date newer than existing version, or delete old version in Cloudflare first.

#### Error: Invalid filename format

```text
Invalid filename: hero-image.jpg
Expected: {name}-YYYY-MM-DD.{ext}
```

**Solution:** Rename file to include CalVer date.

### Local Dev Server Won't Start

**Solution:**

```bash
# Clean build artifacts and caches
mise //ui:clean

# Reinstall dependencies
mise //ui:install

# Try again
mise //ui:dev
```

## FAQ

**Q: Can I write blog posts in regular Markdown (.md)?**
A: No, only `.mdx` is supported. MDX allows React components while maintaining Markdown simplicity.

**Q: Why CalVer instead of semantic versioning?**
A: CalVer (YYYY-MM-DD) makes it obvious when an image was added/updated and provides clear version history
without needing git.

**Q: Where are the images stored?**
A: Cloudflare Images (cloud CDN), NOT in git. `ui/source-images/` is your local working directory (gitignored).

**Q: Can I use images from other blog posts?**
A: Yes! Just reference the Cloudflare Images ID in your frontmatter: `image: "blog/existing-image-2025-11-20"`

**Q: How do I delete an old image from Cloudflare?**
A: Use the Cloudflare Dashboard (Images section) or the Cloudflare API to delete old image versions.

**Q: What if I don't have images ready when I start writing?**
A: Use a placeholder in `ui/source-images/blog/`, upload it with `mise //ui:images:sync`, and update later with a new version.

**Q: How do I add code blocks with syntax highlighting?**
A: Use triple backticks with the language name:

````markdown
```typescript
const example = "Hello, world!";
```
````

**Q: Can I use HTML in my MDX posts?**
A: Yes, MDX supports both Markdown and JSX/HTML syntax.

## Resources

**External:**

- [Unsplash](https://unsplash.com/) - Free stock photos
- [Pexels](https://www.pexels.com/) - Free stock photos
- [OpenGraph Debugger](https://www.opengraph.xyz/) - Test social media previews
- [WebAIM Alt Text Guide](https://webaim.org/techniques/alttext/) - Alt text best practices
- [MDX Documentation](https://mdxjs.com/) - MDX syntax and features

**Internal:**

- [Main README](../../../README.md) - Project overview and tech stack
- [claude.md](../../../claude.md) - AI agent guide (includes build system details)
