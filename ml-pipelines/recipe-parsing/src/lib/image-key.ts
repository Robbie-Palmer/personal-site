export const IMAGE_KEY_SEP = "\u0000";

export function imageSetKey(images: string[]): string {
  return images.join(IMAGE_KEY_SEP);
}
