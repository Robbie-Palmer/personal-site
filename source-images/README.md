# Source Images

This directory contains full-resolution source images that are automatically synced to Cloudflare Images via GitHub Actions.

## Directory Structure

```
source-images/
├── blog/           # Blog post images (featured images and in-content images)
└── README.md       # This file
```

## Workflow

1. **Add Images**: Place full-resolution images in the appropriate subdirectory
2. **Commit**: Commit images to git (they're automatically tracked)
3. **Automatic Sync**: GitHub Actions uploads images to Cloudflare Images on push to main
4. **Use in Code**: Reference images by their filename (without extension) using the `getImageUrl()` utility

## Image Guidelines

### Format
- **JPEG**: Photos, complex images with many colors
- **PNG**: Screenshots, diagrams, images with transparency
- **Original Quality**: Keep source images at full resolution/quality

### Naming Convention
- Use descriptive, kebab-case filenames: `just-right-engineering-featured.png`
- Avoid spaces and special characters
- Featured images should end with `-featured` for clarity

### Size
- No strict limits - Cloudflare Images handles optimization
- Recommended: 2400px wide max for hero images (2x retina at 1200px)
- Originals are stored here, optimized versions served via CDN

## Image IDs

Images are uploaded to Cloudflare Images with IDs based on their relative path:
- `source-images/blog/example.jpg` → Image ID: `blog/example`
- The file extension is removed from the ID

## Usage in Code

```typescript
import { getImageUrl } from '@/lib/cloudflare-images'

// Get thumbnail (600w)
<img src={getImageUrl('blog/just-right-engineering-featured', 'thumbnail')} />

// Get hero image (1200w)
<img src={getImageUrl('blog/just-right-engineering-featured', 'hero')} />

// Get full size with custom transforms
<img src={getImageUrl('blog/just-right-engineering-featured', 'public', { width: 800, format: 'webp' })} />
```

## Cloudflare Images Variants

Variants are configured in Cloudflare Dashboard or via API:

- **public**: Flexible variant, accepts URL parameters for custom transformations
- **thumbnail**: 600w (for blog list cards)
- **hero**: 1200w (for blog post hero images)
- **og**: 1200x630 (for Open Graph images)

## Manual Upload (if needed)

```bash
# Upload a single image
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/images/v1" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -F "file=@source-images/blog/example.jpg" \
  -F "id=blog/example"
```

## Troubleshooting

- **Image not appearing?** Check GitHub Actions logs for upload status
- **404 on image URL?** Verify the image ID matches the filename (without extension)
- **Need to re-upload?** Delete and re-add the file, or trigger a workflow re-run
