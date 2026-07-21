import { sourcePrefix } from "./keys";
import type { Env } from "./env";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    // Uint8Array elements are always 0–255, so every value is a valid code point
    // and maps one-to-one to the binary string expected by btoa.
    binary += String.fromCodePoint(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function listSourceImageKeys(
  env: Env,
  jobId: string,
): Promise<string[]> {
  const listing = await env.ARTIFACTS.list({ prefix: sourcePrefix(jobId) });
  if (listing.truncated) {
    throw new Error(
      `Unexpectedly many source objects for job ${jobId}; listing truncated`,
    );
  }
  return listing.objects
    .map((object) => object.key)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function loadImageDataUrls(
  env: Env,
  keys: string[],
): Promise<string[]> {
  return Promise.all(
    keys.map(async (key) => {
      const object = await env.ARTIFACTS.get(key);
      if (!object) {
        throw new Error(`Source image missing from R2: ${key}`);
      }
      const contentType = object.httpMetadata?.contentType ?? "image/jpeg";
      const bytes = new Uint8Array(await object.arrayBuffer());
      return `data:${contentType};base64,${bytesToBase64(bytes)}`;
    }),
  );
}
