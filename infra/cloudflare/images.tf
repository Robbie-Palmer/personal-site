# Cloudflare Images Configuration
#
# Note: Cloudflare Images doesn't have dedicated Terraform resources for individual
# images. Images are uploaded and managed via the Cloudflare API, which is handled
# by our GitHub Actions workflow (.github/workflows/sync-images.yml).
#
# This file documents the account-level configuration and URL structure.

# Cloudflare Images is an account-level service that provides:
# - Automatic image optimization (WebP, AVIF conversion)
# - On-demand resizing and transformations via URL parameters
# - Global CDN delivery
# - Original image storage
#
# Pricing:
# - $5/month for up to 100,000 images served
# - $1 per 100,000 additional images served
# - Storage: $0.50 per 100,000 images stored per month
#
# URL Structure:
# https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/<VARIANT>
#
# Where:
# - ACCOUNT_HASH: Unique identifier for your Cloudflare account (publicly visible)
# - IMAGE_ID: Unique identifier for each uploaded image
# - VARIANT: Transformation preset (e.g., "public", "thumbnail", "hero")
#
# Variants can be configured in the Cloudflare dashboard or via API:
# - public: Full-size, flexible transformations via URL parameters
# - Custom variants: Predefined sizes (e.g., thumbnail=600w, hero=1200w)
#
# API Authentication:
# Images are uploaded via the Cloudflare Images API using:
# - Account ID: var.cloudflare_account_id
# - API Token: CLOUDFLARE_API_TOKEN (set in GitHub Secrets)
#
# Required API Token Permissions:
# - Account > Cloudflare Images > Edit
#
# For manual setup or debugging, see:
# https://developers.cloudflare.com/images/

# Output the account ID for use in GitHub Actions
output "cloudflare_account_id" {
  description = "Cloudflare account ID for Images API"
  value       = var.cloudflare_account_id
  sensitive   = false # Account ID is not sensitive (it's visible in image URLs)
}
