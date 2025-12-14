const CF_IMAGES_ACCOUNT_HASH = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

const CF_IMAGES_BASE_URL = "https://imagedelivery.net";

export type ImageVariant =
  | "public" // Flexible variant - accepts URL parameters for custom transformations
  | "og"; // 1200w - for OpenGraph metadata

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  format?: "auto" | "webp" | "avif" | "json";
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  /** Image quality (1-100, default 85) */
  quality?: number;
  /** Device pixel ratio (1 or 2 for retina) */
  dpr?: 1 | 2;
}

/** Generates a Cloudflare Images URL. Options only apply to 'public' variant. */
export function getImageUrl(
  imageId: string,
  variant: ImageVariant = "public",
  options?: ImageTransformOptions,
): string {
  if (!CF_IMAGES_ACCOUNT_HASH) {
    throw new Error(
      "NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH environment variable is required. " +
        "Find your account hash in Cloudflare Dashboard > Images.",
    );
  }

  const baseUrl = `${CF_IMAGES_BASE_URL}/${CF_IMAGES_ACCOUNT_HASH}/${imageId}/${variant}`;
  // Add transformation options as query parameters (only for 'public' variant)
  if (variant === "public" && options && Object.keys(options).length > 0) {
    const params = new URLSearchParams();
    if (options.width) params.append("width", options.width.toString());
    if (options.height) params.append("height", options.height.toString());
    if (options.format) params.append("format", options.format);
    if (options.fit) params.append("fit", options.fit);
    if (options.quality) params.append("quality", options.quality.toString());
    if (options.dpr) params.append("dpr", options.dpr.toString());
    return `${baseUrl}?${params.toString()}`;
  }
  return baseUrl;
}

/** Generates a responsive srcset string for the given image. */
export function getImageSrcSet(
  imageId: string,
  variant: ImageVariant = "public",
  widths: number[] = [600, 1200, 2400],
): string {
  if (variant !== "public") {
    // For named variants, just return the variant URL
    return `${getImageUrl(imageId, variant)} 1x`;
  }

  return widths
    .map((width) => {
      const url = getImageUrl(imageId, "public", { width, format: "auto" });
      return `${url} ${width}w`;
    })
    .join(", ");
}
