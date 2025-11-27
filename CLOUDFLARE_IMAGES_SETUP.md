# Cloudflare Images Setup Guide

This document explains the Cloudflare Images integration for optimized image delivery across the site.

## Architecture Overview

This site uses **Cloudflare Images** for image optimization and delivery, demonstrating a production-ready, scalable approach to image management:

- ✅ **Automatic format conversion** (WebP, AVIF) based on browser support
- ✅ **On-demand resizing** via URL parameters
- ✅ **Global CDN delivery** with edge caching
- ✅ **Version-controlled source images** in git
- ✅ **Automated deployment** via GitHub Actions
- ✅ **Type-safe utilities** for URL generation

### Why Cloudflare Images?

1. **CMS-Ready**: Upload once, request any size/format via URL
2. **Zero Maintenance**: No build scripts or manual optimization
3. **Industry Standard**: Same pattern as Cloudinary, imgix, AWS CloudFront
4. **Cost-Effective**: $5/month flat or pay-per-use (pennies for low traffic)
5. **Scalable**: Handles 0 to millions of requests seamlessly

### Dual-Mode Architecture

The implementation supports both production and preview deployments:

**Production (main branch):**
- ✅ CF Images hash configured in environment
- ✅ Serves optimized images from Cloudflare Images CDN
- ✅ Automatic WebP/AVIF conversion, resizing, caching

**Preview deployments (feature branches):**
- ✅ CF Images hash NOT configured
- ✅ Images copied to `public/blog-images/` during build
- ✅ Serves from static files (unoptimized but works!)
- ✅ **Test your blog posts with images before merging**

**Local development:**
- ✅ Same as preview (no CF Images hash)
- ✅ Run `mise run images:copy-to-public` to get images
- ✅ Fallback serves from local files

This architecture ensures:
- 🚀 Production gets optimized delivery
- 🧪 Previews work without CF Images setup
- 💻 Local dev works without extra config
- 🔒 No risk of breaking production from branches

## Directory Structure

```
personal-site/
├── source-images/          # Full-resolution source images (tracked in git)
│   └── blog/              # Blog post images
├── .github/workflows/
│   └── sync-images.yml    # Automated image upload to CF (main branch only)
└── ui/
    ├── lib/
    │   ├── cloudflare-images.ts   # Type-safe URL utilities
    │   └── image-manifest.json    # Generated: maps image IDs to extensions
    └── public/blog-images/        # Generated: copied during build for previews
```

**Note:**
- Cloudflare Images is account-level - no Terraform needed!
- `ui/public/blog-images/` and `ui/lib/image-manifest.json` are generated during build
- These are gitignored - the build process creates them automatically

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

### 4. Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add two **Repository secrets**:
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in dashboard)
   - `CLOUDFLARE_API_TOKEN`: The API token you created above

### 5. Configure Image Variants

Variants define preset transformations for different use cases.

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to Cloudflare Dashboard → **Images** → **Variants**
2. Create these variants:

   | Variant Name | Width | Height | Fit Mode | Use Case |
   |--------------|-------|--------|----------|----------|
   | `thumbnail`  | 600   | -      | scale-down | Blog list cards |
   | `hero`       | 1200  | -      | scale-down | Blog post hero images and OpenGraph |

   Note: `public` variant exists by default and allows flexible URL parameters

#### Option B: Via API

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

### 6. Set Environment Variable

Add the account hash to your Next.js environment:

**For local development:**
Create `.env.local` in the `ui/` directory:
```bash
NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=your-hash-here
```

**For production (Cloudflare Pages):**
1. Go to Cloudflare Pages → Your Project → **Settings** → **Environment variables**
2. Add:
   - Variable name: `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
   - Value: Your account hash
   - Environment: **Production** and **Preview**

### 7. Upload Images

#### Automatic Upload (Recommended)

1. Add images to `source-images/blog/`
2. Commit and push to `main` branch
3. GitHub Actions automatically uploads images to Cloudflare Images
4. Check Actions tab for upload status

**Note:** GitHub Actions uses `FORCE_UPDATE=true`, meaning:
- ✅ **New images**: Uploaded
- ✅ **Changed images**: Updated (delete + re-upload)
- ✅ **Unchanged images**: Still updated (ensures production is fresh)

#### Manual Upload via Mise

**Safe mode (default - skips existing):**
```bash
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"

# Upload only new images (skips existing)
mise run images:sync
```

**Force update mode (updates all):**
```bash
# Update ALL images (delete and re-upload existing)
FORCE_UPDATE=true mise run images:sync
```

**Verify setup:**
```bash
# Check variants are configured
mise run images:verify-variants

# Run full health check (recommended after first setup)
mise run images:health-check
```

#### Manual Upload via API

```bash
# Upload a single image
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -F "file=@source-images/blog/example.jpg" \
  -F "id=blog/example"
```

### 8. Trigger Initial Sync

After setup, upload all existing images:

**Option A: Via GitHub Actions (Recommended)**
1. Go to **Actions** tab in GitHub
2. Select **Sync Images to Cloudflare** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait for completion (~30 seconds for 20 images)

**Option B: Via Mise (Local)**
```bash
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"
mise run images:sync
```

## Usage

### In Blog Posts

Update blog post frontmatter to use CF Images IDs (no extension):

**Before (local path):**
```yaml
---
title: "My Blog Post"
image: "/blog-images/example-featured.jpg"
imageAlt: "Description of image"
---
```

**After (CF Images ID):**
```yaml
---
title: "My Blog Post"
image: "blog/example-featured"
imageAlt: "Description of image"
---
```

The system automatically:
- Serves thumbnails (600w) on the blog list page
- Serves hero images (1200w) on individual blog posts
- Converts to WebP/AVIF based on browser support
- Falls back to local images if CF Images not configured

### In Code

```typescript
import { getImageUrl, resolveImageUrl } from '@/lib/cloudflare-images'

// Get a specific variant
const thumbnailUrl = getImageUrl('blog/example', 'thumbnail')
// => https://imagedelivery.net/{hash}/blog/example/thumbnail

// Get custom size with public variant
const customUrl = getImageUrl('blog/example', 'public', {
  width: 800,
  format: 'webp'
})
// => https://imagedelivery.net/{hash}/blog/example/public?width=800&format=webp

// Resolve either CF Images ID or local path (migration helper)
const url = resolveImageUrl(post.image, 'hero')
// Works with both 'blog/example' and '/blog-images/example.jpg'
```

## Migration Guide

To migrate existing blog posts from local images to Cloudflare Images:

1. **Initial State**: Images in `ui/public/blog-images/`, posts reference `/blog-images/example.jpg`
2. **Copy to source**: Images copied to `source-images/blog/` (already done ✓)
3. **Upload**: Run GitHub Actions workflow to upload to CF Images
4. **Update posts**: Change image references in frontmatter:
   ```yaml
   # Before
   image: "/blog-images/example-featured.jpg"

   # After
   image: "blog/example-featured"
   ```
5. **Test**: Verify images load correctly on blog list and post pages
6. **Cleanup**: Eventually remove `ui/public/blog-images/` (optional, kept for backward compatibility)

## Testing & Verification

### Health Check (Recommended)

Run the comprehensive health check to verify your setup:

```bash
export CF_ACCOUNT_ID="your-account-id"
export CF_API_TOKEN="your-api-token"
export NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH="your-hash"

mise run images:health-check
```

This checks:
1. ✅ Environment variables are set correctly
2. ✅ API connectivity works
3. ✅ At least one test image exists in CF Images
4. ✅ Required variants (thumbnail, hero) are configured
5. ✅ Generates a test URL you can open in browser

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

3️⃣  Checking source images...
   📊 Source images found: 20
   🧪 Test image: blog/how-to-build-wealth-featured
   ✅ Test image exists in Cloudflare Images
   🌐 Test URL: https://imagedelivery.net/abc123/blog/how-to-build-wealth-featured/hero
   💡 Open this URL in browser to verify image loads

4️⃣  Checking image variants...
   ✅ thumbnail variant configured
   ✅ hero variant configured

🏁 Health check complete!
```

### Check Images Uploaded Successfully

```bash
# List all images in your account
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result.images[].id'

# Get specific image details
curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1/blog/example" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq
```

### Test Image URLs

Visit these URLs in your browser (replace `{hash}` with your account hash):

```
# Thumbnail (600w)
https://imagedelivery.net/{hash}/blog/just-right-engineering-featured/thumbnail

# Hero (1200w)
https://imagedelivery.net/{hash}/blog/just-right-engineering-featured/hero

# Custom size
https://imagedelivery.net/{hash}/blog/just-right-engineering-featured/public?width=400&format=webp
```

## Cost Breakdown

### For Essentially Zero Traffic (< 10K page views/month)

**Assumptions:**
- 20 images stored
- 5K page views/month
- 3 images per page view (featured image, potentially some in-content)
- Total: 15K image requests/month

**Pricing Options:**

**Option 1: Pay-per-use**
- Storage: $0.50 per 100K images = $0.01/month
- Delivery: $1 per 100K images = $0.15/month
- **Total: ~$0.16/month** (negligible)

**Option 2: Flat rate**
- $5/month for up to 100K images served
- Unlimited storage included
- **Total: $5/month** (predictable)

### For Growing Traffic (100K+ page views/month)

- Storage: Still negligible ($0.01-0.10/month)
- Delivery: ~$3-5/month depending on images per page
- **Still very cost-effective** compared to alternatives

## Troubleshooting

### Images Not Loading

1. **Check environment variable**: Ensure `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH` is set
2. **Verify upload**: Check GitHub Actions logs for successful upload
3. **Test direct URL**: Try accessing image URL directly in browser
4. **Check browser console**: Look for 404 or 403 errors

### Upload Failures

1. **Check GitHub Secrets**: Ensure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set
2. **Verify API token permissions**: Token must have "Cloudflare Images > Edit" permission
3. **Check quota**: Ensure you haven't hit account limits
4. **Review workflow logs**: Check Actions tab for detailed error messages

### Development Fallback

If CF Images not configured locally, the code automatically falls back to local images:
```
⚠️  NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH not set. Falling back to local images.
```

This allows development without CF Images configured, but you should set it for production.

## Additional Resources

- [Cloudflare Images Documentation](https://developers.cloudflare.com/images/)
- [Image Transformations](https://developers.cloudflare.com/images/transform-images/)
- [API Reference](https://developers.cloudflare.com/api/operations/cloudflare-images-list-images)
- [Pricing](https://www.cloudflare.com/products/cloudflare-images/)

## Future Enhancements

Potential improvements to consider:

1. **Automatic OG image generation**: Generate Open Graph images dynamically from post content
2. **Responsive images**: Use `srcset` for different screen sizes
3. **Lazy loading**: Implement lazy loading for images below the fold
4. **Image analytics**: Track which images are most viewed
5. **Bulk operations**: Scripts to bulk-update frontmatter or delete unused images
