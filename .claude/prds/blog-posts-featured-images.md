---
name: blog-posts-featured-images
description: Add featured images to blog posts for visual appeal and improved SEO
status: backlog
created: 2025-11-11T20:16:08Z
---

# PRD: Blog Posts Featured Images

## Executive Summary

Add support for featured images across the blog to enhance visual appeal on listing pages,
individual post pages, and social media shares. This feature will improve user engagement and SEO
performance by providing rich preview images for all blog content.

## Problem Statement

**What problem are we solving?**
Currently, the blog lacks visual appeal on both the listing page and social media shares. Blog
posts appear as text-only cards, which:

- Reduces engagement and click-through rates on the blog listing page
- Provides poor social media preview experiences (no image in Open Graph/Twitter Cards)
- Misses SEO opportunities, as search engines and social platforms favor content with rich media
- Creates a less professional appearance compared to modern blog standards

**Why is this important now?**
Visual content is critical for modern web experiences. Studies show that content with relevant
images gets 94% more views than content without images. With 12 existing blog posts and ongoing
content creation, implementing featured images will immediately improve user engagement and content
discoverability.

## User Stories

### Primary User Personas

#### Persona 1: Blog Reader/Visitor

- Wants to quickly scan and identify interesting blog posts
- Expects visual cues to understand post topics at a glance
- Shares interesting posts on social media

#### Persona 2: Content Author (You)

- Needs to add featured images when creating new blog posts
- Wants clear guidance on image sourcing and requirements
- Requires the system to validate that images are present

#### Persona 3: Social Media User

- Sees shared links on Twitter, LinkedIn, or other platforms
- Makes decisions on whether to click based on preview image quality
- Expects professional, relevant preview images

### Detailed User Journeys

#### Journey 1: Discovering Content (Blog Visitor)

1. User lands on `/blog` listing page
2. User scans the grid of blog post cards
3. Visual featured images help identify topics of interest (e.g., cybersecurity, data science)
4. User clicks on a post card
5. Individual post page displays the featured image as a hero/header
6. Enhanced visual experience improves engagement and time-on-site

#### Journey 2: Creating New Post (Content Author)

1. Author writes new blog post in MDX format
2. Author adds `image` and `imageAlt` fields to frontmatter
3. Author sources/generates appropriate featured image
4. Author saves image to `/public/blog-images/` directory
5. Build process validates image presence
6. Post is published with featured image visible across all contexts

#### Journey 3: Sharing on Social Media (Social Media User)

1. User encounters blog post link on Twitter/LinkedIn
2. Platform fetches Open Graph metadata
3. Rich preview displays with featured image (1200x630px)
4. Professional preview increases click-through likelihood
5. User clicks through and engages with content

### Pain Points Being Addressed

- **Lack of Visual Differentiation:** Text-only cards make it hard to distinguish posts at a glance
- **Poor Social Media Presence:** Links shared without images perform poorly
- **SEO Disadvantages:** Search engines favor content with rich media signals
- **Unprofessional Appearance:** Modern blogs are expected to have visual elements
- **Content Discovery:** Users miss relevant content due to lack of visual cues

## Requirements

### Functional Requirements

#### FR1: Frontmatter Schema Extension

- Add `image` field to MDX frontmatter (string, required)
  - Path format: `/blog-images/[filename].[ext]`
  - Example: `/blog-images/pii-detection-featured.jpg`
- Add `imageAlt` field to MDX frontmatter (string, required)
  - Descriptive alt text for accessibility compliance
  - Should describe image content, not just repeat post title

#### FR2: Blog Listing Page Display

- Display featured image in each blog post card
- Image should appear above or beside title/description
- Use Next.js `Image` component for automatic optimization
- Implement lazy loading for performance
- Maintain responsive design across mobile, tablet, desktop

#### FR3: Individual Post Page Display

- Display featured image as hero/header on individual post pages
- Position image prominently at top of post content
- Full-width or contained layout (TBD during implementation)
- Maintain aspect ratio and responsive behavior

#### FR4: Social Media Metadata

- Update Open Graph `og:image` meta tag with featured image URL
- Update Twitter Card `twitter:image` meta tag
- Set appropriate dimensions metadata (1200x630px for OG)
- Include image alt text in metadata where supported

#### FR5: Build-Time Validation

- Validate that `image` field is present in all post frontmatter
- Validate that `imageAlt` field is present in all post frontmatter
- Validate that image file exists at specified path
- Build should fail with clear error message if validation fails
- Error messages should specify which post and what's missing

#### FR6: Image Handling

- Support common image formats: JPG, PNG, WebP
- Store images in `/public/blog-images/` directory
- Use Next.js Image component for automatic format optimization
- Generate responsive image sizes automatically
- Implement lazy loading for images below fold

### Non-Functional Requirements

#### NFR1: Performance

- Featured images must not significantly impact page load time
- Lazy loading should be implemented for blog listing page
- Next.js Image optimization should reduce bandwidth usage
- Lighthouse performance score should not decrease

#### NFR2: Accessibility

- All images must have descriptive alt text via `imageAlt` field
- Images should not interfere with screen reader navigation
- Maintain WCAG 2.1 AA compliance
- Alt text should be meaningful and descriptive

#### NFR3: SEO Optimization

- Open Graph images must be 1200x630px minimum
- Images should be optimized for file size (<200KB ideal)
- Proper meta tags for Twitter Cards and Open Graph
- Schema.org markup should include image references

#### NFR4: Developer Experience

- Clear documentation on adding featured images to posts
- Helpful error messages during build failures
- Consistent naming conventions for image files
- Easy-to-follow migration process for existing posts

#### NFR5: Maintainability

- Image paths should be easy to update if directory structure changes
- TypeScript types should enforce frontmatter schema
- Code should follow existing Next.js/React patterns in codebase

## Success Criteria

### Measurable Outcomes

1. **Implementation Complete:**
   - All 12 existing blog posts have featured images
   - All new posts require featured images (enforced at build time)
   - Featured images display correctly on listing page, post pages, and social previews

2. **Visual Quality:**
   - Images are relevant to post content
   - Images maintain quality across devices (responsive)
   - No layout shifts or broken images

3. **Performance Maintained:**
   - Blog listing page load time does not increase significantly
   - Lighthouse performance score remains >90
   - Images are properly optimized and lazy-loaded

4. **SEO Improvement:**
   - All blog URLs have valid Open Graph images when shared
   - Twitter Card validator shows rich previews for all posts
   - Social media click-through rates improve (measured over time)

### Key Metrics and KPIs

- **Implementation Metrics:**
  - 12/12 existing posts have featured images
  - Build validation catches missing images 100% of the time

- **Performance Metrics:**
  - Page load time: <3s on 3G
  - Lighthouse performance: >90
  - Image file sizes: <200KB average

- **Quality Metrics:**
  - All images have descriptive alt text
  - All social media previews render correctly
  - Zero broken image links

## Constraints & Assumptions

### Technical Constraints

- Must use free image sources (Unsplash, Pexels) or AI-generated images
- No budget for paid stock photo services
- Must work within existing Next.js/React architecture
- Must maintain existing blog post structure (MDX with frontmatter)
- Images stored in `/public/` directory (Next.js static serving)

### Resource Constraints

- Image sourcing/generation must be done by content author
- No dedicated designer available for custom graphics
- Implementation must be straightforward for solo developer

### Timeline Constraints

- Migration of 12 existing posts needs to happen before enforcement
- Should not block ongoing blog post creation

### Assumptions

1. Next.js Image component will handle optimization adequately
2. Free image sources (Unsplash, Pexels) have sufficient relevant imagery
3. AI-generated images are acceptable for technical blog content
4. 1200x675px (16:9) images can be used for both listing and social media
5. Author has time to source/generate 12 images for existing posts
6. TypeScript is used for type safety in blog post schema

## Out of Scope

The following items are explicitly **NOT** included in this feature:

1. **Multiple Images Per Post:** Only one featured image per post, not galleries
2. **Image Upload Interface:** No admin UI for uploading images; manual file management only
3. **Automatic Image Generation:** No automated AI image generation; manual sourcing required
4. **Image Editing Tools:** No built-in cropping, resizing, or editing capabilities
5. **CDN Integration:** Images served from `/public/`, not external CDN
6. **Dynamic Image Sizing:** Fixed aspect ratios, not customizable per post
7. **Image Captions:** Alt text only, no visible captions on images
8. **Inline Content Images:** Only featured images, not managing inline post images
9. **RSS Feed Images:** Focus on web display only, RSS feed support deferred
10. **Analytics on Images:** No tracking of image views or engagement separately

## Dependencies

### External Dependencies

- **Free Image Sources:**
  - Unsplash API or manual download (<https://unsplash.com>)
  - Pexels API or manual download (<https://pexels.com>)
  - Alternative: AI generation tools (free tier limitations)

- **Next.js Image Component:**
  - Requires Next.js 13+ (assumption: already on compatible version)
  - Automatic WebP conversion and optimization

### Internal Dependencies

- **Blog Infrastructure:**
  - `getAllPosts()` function in `/ui/lib/blog.ts` (or similar)
  - MDX frontmatter parsing (gray-matter or similar)
  - TypeScript `BlogPost` type definition

- **Components:**
  - `BlogList` component (`/ui/components/blog/blog-list.tsx`)
  - Individual post page template (`/ui/app/blog/[slug]/page.tsx`)
  - Metadata generation functions

### Team Dependencies

- **Content Author (You):**
  - Source/generate 12 featured images for existing posts
  - Write descriptive alt text for each image
  - Maintain image quality standards going forward

## Implementation Phases

### Phase 1: Technical Implementation (Week 1)

**Tasks:**

1. Update TypeScript `BlogPost` type to include `image` and `imageAlt` fields
2. Modify blog listing component to display featured images
3. Update individual post page template to show hero image
4. Add Open Graph and Twitter Card meta tags for images
5. Implement build-time validation for required fields
6. Test with sample images

**Deliverables:**

- Code changes merged and deployed to staging
- Build validation working correctly
- Sample images displaying properly

### Phase 2: Image Sourcing & Migration (Week 2)

**Tasks:**

1. Create image sourcing guidelines document
2. Source/generate 12 featured images for existing posts
3. Write alt text for each image
4. Update all 12 MDX files with `image` and `imageAlt` fields
5. Optimize images for web (resize, compress)
6. Save images to `/public/blog-images/` with consistent naming

**Deliverables:**

- All 12 posts have featured images
- All images meet quality and size requirements
- Migration complete checklist

### Phase 3: Validation & Launch (Week 3)

**Tasks:**

1. Enable build validation (switch from warning to error)
2. Test all blog pages for visual correctness
3. Validate social media previews using Twitter/LinkedIn validators
4. Run Lighthouse performance tests
5. Fix any issues identified
6. Deploy to production

**Deliverables:**

- Production deployment with all featured images
- Performance benchmarks documented
- Social media preview validation complete

## Image Sourcing Guidelines

### Recommended Free Sources

1. **Unsplash (<https://unsplash.com>)**
   - High-quality, free-to-use photos
   - Good for abstract concepts, technology themes
   - Search for keywords related to post topics

2. **Pexels (<https://pexels.com>)**
   - Another quality free stock photo service
   - Similar licensing to Unsplash

3. **AI-Generated Images**
   - DALL-E (OpenAI) - Limited free tier
   - Midjourney - Requires subscription after trial
   - Bing Image Creator - Free with Microsoft account
   - Considerations: May need multiple attempts to get quality results

4. **Simple Graphics/Illustrations**
   - Create simple branded graphics with text overlays
   - Use tools like Canva (free tier) for basic designs
   - Consider abstract patterns or gradients for technical topics

### Image Specifications

- **Dimensions:** 1200x675px (16:9 aspect ratio) recommended
- **File Size:** Target <200KB, maximum 500KB
- **Format:** JPG for photos, PNG for graphics with transparency
- **Quality:** High enough for social media previews (no pixelation)

### Image Selection Criteria

1. **Relevance:** Image should relate to post topic (e.g., security for cybersecurity posts)
2. **Professional:** Avoid overly casual or low-quality images
3. **Not Overly Literal:** Abstract representations often work better than literal depictions
4. **Consistent Style:** Maintain similar visual style across posts where possible
5. **Accessibility:** Avoid images with text as primary content (use alt text instead)

### Naming Convention

Use descriptive names that match post slugs:

- `/public/blog-images/[post-slug]-featured.jpg`
- Example: `/blog-images/pii-detection-featured.jpg`
- Alternative: `/blog-images/quasi-experiments-featured.png`

## Migration Checklist for Existing Posts

- [ ] 2020-07-25-why-you-should-not-buy-a-house.mdx
- [ ] 2020-09-27-how-to-build-wealth.mdx
- [ ] 2021-12-10-just-right-engineering.mdx
- [ ] 2022-02-07-post-modern-management.mdx
- [ ] 2022-02-28-enabling-multi-omic-data-management.mdx
- [ ] 2022-03-02-the-philosophy-of-data-science.mdx
- [ ] 2022-03-28-quasi-experiments.mdx
- [ ] 2022-06-29-navigating-titles-in-the-ml-market.mdx
- [ ] 2023-02-24-effective-ethical-data-science-study-design.mdx
- [ ] 2023-03-28-uniting-machine-learning-data-streaming-1.mdx
- [ ] 2023-04-04-uniting-machine-learning-data-streaming-2.mdx
- [ ] 2023-05-23-automatically-detect-pii-real-time-cyber-defense.mdx

Each post requires:

1. Featured image sourced/generated
2. Image saved to `/public/blog-images/[slug]-featured.[ext]`
3. Frontmatter updated with `image: "/blog-images/[filename]"`
4. Frontmatter updated with `imageAlt: "[descriptive alt text]"`

## Technical Implementation Notes

### Frontmatter Example

```yaml
---
title: "How To Automatically Detect PII for Real-Time Cyber Defense"
description: "Using machine learning-powered PII detection to enable advanced SIEM..."
date: "2023-05-23"
tags: ["data-governance", "cybersecurity", "machine-learning"]
image: "/blog-images/pii-detection-featured.jpg"
imageAlt: "Abstract visualization of data streams with security locks and machine learning nodes"
canonical: "https://www.confluent.io/blog/pii-detection-real-time-cyber-defense/"
---

```text

### TypeScript Type Extension

```typescript
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
  readingTime: string;
  canonical?: string;
  updated?: string;
  image: string; // NEW: Required featured image path
  imageAlt: string; // NEW: Required alt text for accessibility
}

```text

### Build Validation Pseudocode

```typescript
// During getAllPosts() or similar build-time function
function validateBlogPost(post: BlogPost, filePath: string) {
  const errors: string[] = [];

  if (!post.image) {
    errors.push(`Missing 'image' field in frontmatter`);
  }

  if (!post.imageAlt) {
    errors.push(`Missing 'imageAlt' field in frontmatter`);
  }

  if (post.image && !fs.existsSync(`./public${post.image}`)) {
    errors.push(`Image file not found: ${post.image}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Blog post validation failed for ${filePath}:\n${errors.join('\n')}`
    );
  }
}

```text

## Risk Analysis

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Images slow down page load | High | Medium | Use Next.js Image optimization, lazy loading, size limits |
| Breaking existing blog functionality | High | Low | Thorough testing, gradual rollout, keep validation as warnings initially |
| Image sourcing takes longer than expected | Medium | High | Start with AI generation for speed, improve quality iteratively |
| Build failures during migration | Medium | Medium | Keep validation as warnings until all images added |

### Content Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Difficulty finding relevant images | Medium | High | Use abstract/generic tech images as fallback |
| Inconsistent image quality/style | Low | Medium | Create style guidelines, review images before adding |
| Copyright/licensing issues | High | Low | Only use verified free sources (Unsplash, Pexels) |

## Questions for Later Resolution

These questions can be answered during implementation:

1. **Image Layout on Blog Cards:** Above title or beside text?
2. **Hero Image Styling:** Full-width or contained? Height constraints?
3. **Hover Effects:** Should cards have image zoom/overlay on hover?
4. **Loading States:** Skeleton/blur placeholder for images?
5. **Error Handling:** What to display if image fails to load in production?

## Related Documentation

- [Next.js Image Component Documentation](https://nextjs.org/docs/api-reference/next/image)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [WCAG Image Accessibility Guidelines](https://www.w3.org/WAI/tutorials/images/)
- [Unsplash License](https://unsplash.com/license)
- [Pexels License](https://www.pexels.com/license/)

## Appendix: Example Image Alt Text

Good alt text examples for technical blog posts:

- ❌ Bad: "image of computer"
- ❌ Bad: "featured image for blog post"
- ✅ Good: "Diagram showing data streaming through PII detection and filtering layers"
- ✅ Good: "Abstract visualization of interconnected data nodes representing machine learning"
- ✅ Good: "Conceptual illustration of cybersecurity monitoring with real-time alerts"

Alt text should:

- Describe the image content concisely (1-2 sentences max)
- Not repeat the post title verbatim
- Not use phrases like "image of" or "picture of"
- Describe what's visually important, not decorative details
