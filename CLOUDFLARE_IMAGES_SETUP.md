# Cloudflare Images Setup Guide

This document explains the Cloudflare Images integration with CalVer versioning for production-grade image management.

## Architecture Overview

This site uses **Cloudflare Images with CalVer versioning** to demonstrate a scalable, professional approach to image management:

- ✅ **Automatic format conversion** (WebP, AVIF) based on browser support
- ✅ **On-demand resizing** via URL parameters
- ✅ **Global CDN delivery** with edge caching
- ✅ **CalVer versioning** (YYYYMMDD) for rollbacks and version control
- ✅ **No binary blobs in git** - images stored in Cloudflare
- ✅ **Type-safe utilities** for URL generation
- ✅ **Preview deployments use production stack** - test real performance

### Why Cloudflare Images + CalVer?

**Business Value:**
1. **Scalable**: 0 to millions of requests with no architecture changes
2. **Cost-Effective**: ~$0.16/month for low traffic, predictable at scale
3. **Zero Maintenance**: No build scripts, no optimization, no storage bloat
4. **Industry Standard**: Same pattern as Cloudinary, imgix, AWS CloudFront

**Technical Benefits:**
1. **Version Control Without Git**: CalVer naming (e.g., `hero-image-20251127`) enables:
   - Easy rollbacks (update reference in code)
   - Clear version history (dates in filenames)
   - No git repository bloat from binary files
   - Fast clones (no large binary history)

2. **Preview Deployments Match Production**:
   - Same CF Images URLs in preview and production
   - Catch image loading issues before merging
   - Test real CDN performance
   - No dual-mode fallback complexity

3. **Self-Documenting**:
   - Image dates visible in filenames
   - Easy to identify old/unused versions
   - Simple cleanup of outdated images

### Why NOT Store Images in Git?

Git is not designed for binary files:
- ❌ Repository size grows forever (even if you delete images later)
- ❌ Clones download entire image history
- ❌ Diffs don't work for binary files
- ❌ LFS adds complexity and cost

CalVer versioning solves this by:
- ✅ Version control through naming convention
- ✅ Storage in Cloudflare (designed for binaries)
- ✅ Keep git repo lean and fast
- ✅ Cheap storage ($0.50 per 100K images)

## Directory Structure

```
personal-site/
├── .gitignore             # Excludes ui/source-images/
├── .github/workflows/
│   └── sync-images.yml   # Weekly health check (manual trigger available)
└── ui/
    ├── source-images/     # Local working copy (GITIGNORED)
    │   └── blog/         # Images with CalVer naming: {name}-YYYYMMDD.{ext}
    └── lib/
        └── cloudflare-images.ts   # Type-safe URL generation
```

**Key Points:**
- `ui/source-images/` is **gitignored** - not tracked in version control
- Images are versioned using **CalVer** in the filename
- Cloudflare Images is the source of truth, not git
- Upload images manually before pushing code changes

## Setup Instructions

### 1. Enable Cloudflare Images

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Go to **Images** in the sidebar
4. Enable Cloudflare Images (if not already enabled)

### 2. Get Your Account Hash

The account hash is publicly visible in image URLs and is used to construct delivery URLs.

1. In Cloudflare Dashboard, go to **Images**
2. Look at the **Delivery URL** section
3. Your hash is in the URL: `https://imagedelivery.net/<YOUR_HASH_HERE>/...`
4. Copy the hash (e.g., `AbCdEfGh123`)

### 3. Create an API Token

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Images** template
4. Set permissions:
   - **Account** > **Cloudflare Images** > **Edit**
5. Set **Account Resources**: Include your account
6. Click **Continue to Summary** → **Create Token**
7. **Copy the token immediately** (you won't see it again!)

### 4. Configure Environment Variables

**Local development** (`.env.local` in `ui/` directory):
```bash
NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=your-hash-here
CF_ACCOUNT_ID=your-account-id
CF_API_TOKEN=your-api-token
```

**Production (Cloudflare Pages):**
1. Go to Cloudflare Pages → Your Project → **Settings** → **Environment variables**
2. Add for both Production and Preview environments:
   - `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`: Your account hash
   - `CF_ACCOUNT_ID`: Your account ID (for health checks, optional)
   - `CF_API_TOKEN`: Your API token (for health checks, optional)

**GitHub Secrets (for health check workflow):**
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `CF_IMAGES_ACCOUNT_HASH`

### 5. Configure Image Variants

Variants define preset transformations for different use cases.

#### Via Cloudflare Dashboard (Recommended)

1. Go to Cloudflare Dashboard → **Images** → **Variants**
2. Create these variants:

   | Variant Name | Width | Height | Fit Mode | Use Case |
   |--------------|-------|--------|----------|----------|
   | `thumbnail`  | 600   | -      | scale-down | Blog list cards |
   | `hero`       | 1200  | -      | scale-down | Blog post hero images and OpenGraph |

   Note: `public` variant exists by default and allows flexible URL parameters

#### Via API

```bash
# Create thumbnail variant (600w)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/variants" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "thumbnail",
    "options": {
      "width": 600,
      "fit": "scale-down"
    }
  }'

# Create hero variant (1200w)
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/variants" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "hero",
    "options": {
      "width": 1200,
      "fit": "scale-down"
    }
  }'
```

### 6. Verify Setup

Run the health check to verify configuration:

```bash
mise run //ui:images:health-check
```

This validates:
- ✅ Environment variables are set
- ✅ API connectivity works
- ✅ Variants are configured correctly
- ✅ Can generate test URLs

## Workflow: Adding or Updating Images

### Adding a New Image

1. **Save image locally** with CalVer naming in `ui/source-images/blog/`:
   ```
   Format: {descriptive-name}-YYYYMMDD.{ext}
   Example: hero-image-20251127.jpg
   ```

2. **Upload to Cloudflare Images**:
   ```bash
   cd ui
   mise run images:sync
   ```

   This will:
   - ✅ Validate CalVer naming format
   - ✅ Check for duplicates (only one version per image locally)
   - ✅ Upload only new images
   - ✅ Validate version ordering (new version must be later than existing)

3. **Update blog post frontmatter**:
   ```yaml
   ---
   title: "My Blog Post"
   image: "blog/hero-image-20251127"  # No extension, includes date
   imageAlt: "Description of image"
   ---
   ```

4. **Test locally**: Start dev server and verify image loads

5. **Commit and push**: Only code changes are tracked in git (not images!)

### Updating an Existing Image

1. **Save new version** with updated CalVer date:
   ```
   Old: ui/source-images/blog/hero-image-20251127.jpg
   New: ui/source-images/blog/hero-image-20251201.jpg
   ```

2. **Delete old version** from `ui/source-images/blog/` (keep only latest locally)

3. **Upload new version**:
   ```bash
   cd ui
   mise run images:sync
   ```

   The sync task will:
   - ✅ Validate new date is later than existing versions in Cloudflare
   - ✅ Upload new version
   - ✅ Keep old version in Cloudflare (for rollback capability)

4. **Update blog post** to reference new version:
   ```yaml
   image: "blog/hero-image-20251201"
   ```

5. **Commit and push code changes**

### Rolling Back to Previous Version

Simply update the blog post frontmatter to reference the older version:

```yaml
# Rollback
image: "blog/hero-image-20251127"  # Old version still in Cloudflare
```

No need to re-upload - all versions persist in Cloudflare until manually deleted.

## Naming Convention

**Format:** `{descriptive-name}-{YYYYMMDD}.{ext}`

**Examples:**
- `hero-image-20251127.jpg`
- `diagram-architecture-20251130.png`
- `screenshot-dashboard-20251201.png`

**Rules:**
- ✅ Lowercase letters, numbers, hyphens only for name
- ✅ Exactly 8 digits for date (YYYYMMDD)
- ✅ Valid calendar date (validated by sync task)
- ❌ Only one version of each image locally (sync task enforces this)

## Usage in Code

### Blog Posts

```yaml
---
title: "My Blog Post"
description: "Post description"
date: "2025-11-27"
tags: ["example"]
image: "blog/hero-image-20251127"  # CalVer versioned ID
imageAlt: "Description of image"
---
```

The system automatically:
- Serves thumbnails (600w) on blog list page
- Serves hero images (1200w) on blog post pages
- Uses hero variant for OpenGraph images
- Converts to WebP/AVIF based on browser support

### TypeScript

```typescript
import { getImageUrl, resolveImageUrl } from '@/lib/cloudflare-images'

// Get a specific variant
const thumbnailUrl = getImageUrl('blog/hero-image-20251127', 'thumbnail')
// => https://imagedelivery.net/{hash}/blog/hero-image-20251127/thumbnail

// Get custom size with public variant
const customUrl = getImageUrl('blog/hero-image-20251127', 'public', {
  width: 800,
  format: 'webp'
})
// => https://imagedelivery.net/{hash}/blog/hero-image-20251127/public?width=800&format=webp

// Convenience wrapper
const url = resolveImageUrl('blog/hero-image-20251127', 'hero')
```

## Mise Tasks

All image tasks are in `ui/mise.toml`:

### `mise run //ui:images:sync`

Uploads local images to Cloudflare Images with validation:
- Validates CalVer naming format
- Checks for duplicate root names locally
- Validates version ordering against Cloudflare
- Uploads only new versions

**Usage:**
```bash
cd ui
mise run images:sync
```

### `mise run //ui:images:health-check`

Comprehensive validation of Cloudflare Images setup:
- Checks environment variables
- Tests API connectivity
- Lists example images
- Verifies variants are configured
- Generates test URLs

**Usage:**
```bash
mise run //ui:images:health-check
```

## Testing & Verification

### Health Check

```bash
cd ui
mise run images:health-check
```

**Example output:**
```
🏥 Running Cloudflare Images health check...

1️⃣  Checking environment configuration...
   ✅ NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is set
   ✅ CF_ACCOUNT_ID is set
   ✅ CF_API_TOKEN is set

2️⃣  Testing API connectivity...
   ✅ API connection successful
   📊 Total images in account: 20
   📋 Example images:
      - blog/hero-image-20251127
      - blog/diagram-arch-20251128
      - blog/screenshot-dashboard-20251129

3️⃣  Checking image variants...
   ✅ thumbnail variant configured (600w for blog list)
   ✅ hero variant configured (1200w for blog hero & OG)

   💡 Configure variants in Cloudflare Dashboard:
      https://dash.cloudflare.com/{account}/images/variants

4️⃣  Testing image URL generation...
   🧪 Test image ID: blog/hero-image-20251127
   🌐 Test URL: https://imagedelivery.net/{hash}/blog/hero-image-20251127/hero
   💡 Open this URL in browser to verify image loads

🏁 Health check complete!
```

### Manual API Testing

```bash
# List all images
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result.images[].id'

# Get specific image details
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/blog/hero-image-20251127" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq

# Delete old version (cleanup)
curl -X DELETE "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/blog/hero-image-20251127" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

### Test Image URLs

Visit in browser (replace `{hash}` with your account hash):

```
# Thumbnail (600w)
https://imagedelivery.net/{hash}/blog/hero-image-20251127/thumbnail

# Hero (1200w)
https://imagedelivery.net/{hash}/blog/hero-image-20251127/hero

# Custom size
https://imagedelivery.net/{hash}/blog/hero-image-20251127/public?width=400&format=webp
```

## Cost Breakdown

### For Low Traffic (< 10K page views/month)

**Assumptions:**
- 20 images stored (multiple versions = ~40 total)
- 5K page views/month
- 3 images per page
- Total: 15K image requests/month

**Pay-per-use pricing:**
- Storage: $0.50 per 100K images = $0.20/month
- Delivery: $1 per 100K requests = $0.15/month
- **Total: ~$0.35/month** (negligible)

**Flat rate alternative:**
- $5/month for up to 100K requests
- Unlimited storage
- **Total: $5/month** (predictable, worth it at ~50K+ requests/month)

### For Growing Traffic (100K+ page views/month)

- Storage: Still negligible ($0.20-1.00/month)
- Delivery: ~$3-8/month depending on images per page
- **Still very cost-effective** compared to bandwidth + storage + CDN separately

## Cleanup & Maintenance

### Finding Old Versions

```bash
# List all images, grouped by root name
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  | jq -r '.result.images[].id' \
  | sort
```

Example output:
```
blog/hero-image-20251101
blog/hero-image-20251115
blog/hero-image-20251127  ← Latest version
blog/other-image-20251120
```

### Deleting Old Versions

```bash
# Delete a specific old version
curl -X DELETE "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/blog/hero-image-20251101" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

**When to delete:**
- After confirming new version works in production
- When storage costs become a concern (unlikely for most sites)
- When you have dozens of versions of the same image

**Keep at least:**
- Current version (referenced in code)
- Previous 1-2 versions (for quick rollback)

## Troubleshooting

### Build Fails: Missing CF_IMAGES_ACCOUNT_HASH

**Error:**
```
Error: NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is required
```

**Solution:**
Set the environment variable in `.env.local` (local) or Cloudflare Pages settings (production)

### Image Not Found (404)

**Possible causes:**
1. Image not uploaded to Cloudflare Images
2. Wrong image ID in frontmatter
3. Image ID doesn't match uploaded ID

**Debug:**
```bash
# Check if image exists
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/blog/hero-image-20251127" \
  -H "Authorization: Bearer $CF_API_TOKEN"

# List all images
mise run //ui:images:health-check
```

### Upload Fails: Version Validation Error

**Error:**
```
❌ Version validation failed:
   Latest existing version: 20251130
   New version: 20251127
   New version must be later than existing versions
```

**Solution:**
Use a date newer than the existing version. If you need to re-upload the same date, delete the existing version first.

### Upload Fails: Invalid Filename

**Error:**
```
❌ Invalid filename format: hero-image.jpg
   Expected: {name}-YYYYMMDD.{ext}
```

**Solution:**
Rename file to include CalVer date: `hero-image-20251127.jpg`

## Additional Resources

- [Cloudflare Images Documentation](https://developers.cloudflare.com/images/)
- [Image Transformations](https://developers.cloudflare.com/images/transform-images/)
- [API Reference](https://developers.cloudflare.com/api/operations/cloudflare-images-list-images)
- [Pricing](https://www.cloudflare.com/products/cloudflare-images/)

## Future Enhancements

Potential improvements:

1. **Automated cleanup**: Script to delete versions older than N days (keeping latest)
2. **Version comparison**: CLI tool to compare image versions visually
3. **Bulk renaming**: Script to add CalVer dates to existing images
4. **Image analytics**: Track which versions are most viewed
5. **Automatic OG image generation**: Generate Open Graph images from post content
