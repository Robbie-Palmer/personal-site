import { z } from "zod";

const previewApiOriginMessage =
  "PREVIEW_API_URL must be an HTTPS origin without credentials, a path, a query, or a fragment";

export const previewApiOriginSchema = z
  .httpUrl({ error: previewApiOriginMessage })
  .transform((value) => new URL(value))
  // A canonical HTTPS origin has no components beyond `${origin}/`.
  .refine(
    (url) => url.protocol === "https:" && url.href === `${url.origin}/`,
    previewApiOriginMessage,
  )
  .brand<"PreviewApiOrigin">();

export type PreviewApiOrigin = z.infer<typeof previewApiOriginSchema>;

const rootRelativePathSchema = z
  .string()
  .startsWith("/", "Preview API path must be root-relative")
  .refine(
    (path) => !path.startsWith("//"),
    "Preview API path must be root-relative",
  );

export function previewApiRequestURL(
  apiURL: PreviewApiOrigin,
  path: string,
): URL {
  const requestURL = new URL(rootRelativePathSchema.parse(path), apiURL);
  if (requestURL.origin !== apiURL.origin) {
    throw new TypeError(`Preview API URL must stay on ${apiURL.origin}`);
  }
  return requestURL;
}
