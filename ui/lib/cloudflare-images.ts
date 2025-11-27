/**
 * Cloudflare Images URL generation utilities
 *
 * This module provides type-safe helpers for generating Cloudflare Images URLs
 * with proper variants and transformations.
 *
 * Images are versioned using CalVer (YYYYMMDD) in the filename to enable
 * version control and easy rollbacks without storing binaries in git.
 *
 * @see https://developers.cloudflare.com/images/
 */

// Cloudflare Images configuration
// The account hash is publicly visible in image URLs and is not sensitive
// You can find it in your Cloudflare Dashboard under Images
const CF_IMAGES_ACCOUNT_HASH = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

// Base URL for Cloudflare Images delivery
const CF_IMAGES_BASE_URL = 'https://imagedelivery.net';

/**
 * Predefined image variants configured in Cloudflare Dashboard
 * Each variant has specific transformation settings (width, height, fit, etc.)
 */
export type ImageVariant =
  | 'public'      // Flexible variant - accepts URL parameters for custom transformations
  | 'thumbnail'   // 600w - for blog list cards
  | 'hero';       // 1200w - for blog post hero images and OpenGraph

/**
 * URL transformation options for the 'public' variant
 * These are applied as query parameters to the image URL
 *
 * @see https://developers.cloudflare.com/images/transform-images/
 */
export interface ImageTransformOptions {
  /** Width in pixels (e.g., 800) */
  width?: number;
  /** Height in pixels (e.g., 600) */
  height?: number;
  /** Output format (auto, webp, avif, json) - 'auto' serves best format based on browser */
  format?: 'auto' | 'webp' | 'avif' | 'json';
  /** How to fit image in given dimensions */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  /** Image quality (1-100, default 85) */
  quality?: number;
  /** Device pixel ratio (1 or 2 for retina) */
  dpr?: 1 | 2;
}

/**
 * Generates a Cloudflare Images URL for the given image ID and variant
 *
 * @param imageId - Image identifier with CalVer version (e.g., 'blog/hero-image-20251127')
 *                  Format: blog/{name}-{YYYYMMDD}
 * @param variant - The variant to use (default: 'public')
 * @param options - Transformation options (only applies to 'public' variant)
 * @returns Full Cloudflare Images URL
 *
 * @example
 * // Get thumbnail version
 * getImageUrl('blog/hero-image-20251127', 'thumbnail')
 * // => https://imagedelivery.net/{hash}/blog/hero-image-20251127/thumbnail
 *
 * @example
 * // Get custom size with public variant
 * getImageUrl('blog/example-20251127', 'public', { width: 800, format: 'webp' })
 * // => https://imagedelivery.net/{hash}/blog/example-20251127/public?width=800&format=webp
 *
 * @example
 * // Get hero image for retina display
 * getImageUrl('blog/example-20251127', 'hero')
 * // => https://imagedelivery.net/{hash}/blog/example-20251127/hero
 */
export function getImageUrl(
  imageId: string,
  variant: ImageVariant = 'public',
  options?: ImageTransformOptions,
): string {
  if (!CF_IMAGES_ACCOUNT_HASH) {
    throw new Error(
      'NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH is required. ' +
      'Set it in your .env file. Find it in Cloudflare Dashboard > Images.'
    );
  }

  // Build base URL
  const baseUrl = `${CF_IMAGES_BASE_URL}/${CF_IMAGES_ACCOUNT_HASH}/${imageId}/${variant}`;

  // Add transformation options as query parameters (only for 'public' variant)
  if (variant === 'public' && options && Object.keys(options).length > 0) {
    const params = new URLSearchParams();

    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.format) params.append('format', options.format);
    if (options.fit) params.append('fit', options.fit);
    if (options.quality) params.append('quality', options.quality.toString());
    if (options.dpr) params.append('dpr', options.dpr.toString());

    return `${baseUrl}?${params.toString()}`;
  }

  return baseUrl;
}

/**
 * Helper function to get a responsive srcset for an image
 * Useful for <img srcset> or <Image> components
 *
 * @param imageId - Image identifier with CalVer version
 * @param variant - The variant to use
 * @param widths - Array of widths to generate (default: [600, 1200, 2400])
 * @returns srcset string for use in img elements
 *
 * @example
 * <img
 *   src={getImageUrl('blog/example-20251127', 'hero')}
 *   srcSet={getImageSrcSet('blog/example-20251127', 'public', [600, 1200, 2400])}
 *   sizes="(max-width: 768px) 100vw, 1200px"
 * />
 */
export function getImageSrcSet(
  imageId: string,
  variant: ImageVariant = 'public',
  widths: number[] = [600, 1200, 2400],
): string {
  if (variant !== 'public') {
    // For named variants, just return the variant URL
    return `${getImageUrl(imageId, variant)} 1x`;
  }

  return widths
    .map((width) => {
      const url = getImageUrl(imageId, 'public', { width, format: 'auto' });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Resolves an image reference to a URL
 *
 * @param imageRef - CF Images ID with CalVer version (e.g., 'blog/hero-image-20251127')
 *                    or legacy local path (e.g., '/blog-images/image.jpg')
 * @param variant - The variant to use (ignored for local paths)
 * @param options - Transformation options (ignored for local paths)
 * @returns Image URL
 *
 * @example
 * resolveImageUrl('blog/example-20251127', 'thumbnail')
 * // => https://imagedelivery.net/{hash}/blog/example-20251127/thumbnail
 *
 * @example
 * // Legacy local path support (temporary migration)
 * resolveImageUrl('/blog-images/image.jpg')
 * // => /blog-images/image.jpg
 */
export function resolveImageUrl(
  imageRef: string,
  variant?: ImageVariant,
  options?: ImageTransformOptions,
): string {
  // Legacy local path support (temporary for migration)
  if (imageRef.startsWith('/')) {
    return imageRef;
  }

  return getImageUrl(imageRef, variant, options);
}
