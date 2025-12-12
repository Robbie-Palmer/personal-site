#!/bin/bash
#
# Script to migrate blog post image references from local paths to CF Images IDs
#
# Usage:
#   ./scripts/migrate-blog-images.sh
#
# This script will:
# 1. Find all MDX files in ui/content/blog/
# 2. Replace image frontmatter from local paths to CF Images IDs
# 3. Example: "/blog-images/example.jpg" -> "blog/example"
#

set -e

BLOG_DIR="ui/content/blog"
DRY_RUN="${DRY_RUN:-false}"

echo "🔍 Scanning blog posts in $BLOG_DIR..."
echo ""

if [ "$DRY_RUN" = "true" ]; then
  echo "🧪 DRY RUN MODE - No files will be modified"
  echo ""
fi

# Counter for tracking
updated=0
skipped=0

# Find all .mdx files
find "$BLOG_DIR" -name "*.mdx" | while read -r file; do
  echo "📄 Processing: $file"

  # Check if file contains /blog-images/ in image field
  if grep -q 'image: *"/blog-images/' "$file"; then
    # Extract current image path for display
    current_image=$(grep 'image: *"/blog-images/' "$file" | sed 's/^image: *"//' | sed 's/"$//')

    # Convert path to CF Images ID
    # /blog-images/example.jpg -> blog/example
    new_image=$(echo "$current_image" | sed 's|^/blog-images/|blog/|' | sed 's/\.[^.]*$//')

    echo "  Current: $current_image"
    echo "  New:     $new_image"

    if [ "$DRY_RUN" = "false" ]; then
      # Perform the replacement
      # Match: image: "/blog-images/filename.ext"
      # Replace with: image: "blog/filename"
      sed -i 's|image: *"/blog-images/\([^.]*\)\.[^"]*"|image: "blog/\1"|' "$file"
      echo "  ✅ Updated"
      updated=$((updated + 1))
    else
      echo "  🧪 Would update (dry run)"
      updated=$((updated + 1))
    fi
  else
    echo "  ⏭️  Already using CF Images ID or no image field"
    skipped=$((skipped + 1))
  fi

  echo ""
done

echo "📊 Summary:"
echo "  ✅ Updated: $updated posts"
echo "  ⏭️  Skipped: $skipped posts"
echo ""

if [ "$DRY_RUN" = "true" ]; then
  echo "To perform the actual migration, run:"
  echo "  ./scripts/migrate-blog-images.sh"
else
  echo "✅ Migration complete!"
  echo ""
  echo "Next steps:"
  echo "1. Review the changes: git diff ui/content/blog/"
  echo "2. Test the site: mise run //ui:dev"
  echo "3. Commit the changes: git add ui/content/blog/ && git commit -m 'Migrate blog images to Cloudflare Images'"
fi
