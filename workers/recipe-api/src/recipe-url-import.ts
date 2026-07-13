const MAX_RECIPE_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

export class RecipeUrlImportError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 | 422 | 502 | 504,
  ) {
    super(message);
    this.name = "RecipeUrlImportError";
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const [first, second] = octets as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export function validateRecipeUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new RecipeUrlImportError("Enter a valid recipe page URL", 400);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RecipeUrlImportError("Recipe URLs must use http or https", 400);
  }
  if (url.username || url.password) {
    throw new RecipeUrlImportError("Recipe URLs must not contain credentials", 400);
  }
  if (
    (url.protocol === "http:" && url.port && url.port !== "80") ||
    (url.protocol === "https:" && url.port && url.port !== "443")
  ) {
    throw new RecipeUrlImportError("Recipe URLs must use a standard web port", 400);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes(":") ||
    isPrivateIpv4(hostname)
  ) {
    throw new RecipeUrlImportError("That recipe URL cannot be accessed", 400);
  }
  return url;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RECIPE_PAGE_BYTES
  ) {
    throw new RecipeUrlImportError("The recipe page is too large to import", 413);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RECIPE_PAGE_BYTES) {
      await reader.cancel();
      throw new RecipeUrlImportError("The recipe page is too large to import", 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchRecipePage(
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ html: string; url: string }> {
  let url = validateRecipeUrl(rawUrl);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetcher(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "RecipeImporter/1.0 (+https://robbiepalmer.me/recipes)",
        },
        redirect: "manual",
        signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          throw new RecipeUrlImportError(
            "The recipe page redirected too many times",
            502,
          );
        }
        url = validateRecipeUrl(new URL(location, url));
        continue;
      }
      if (!response.ok) {
        throw new RecipeUrlImportError("The recipe page could not be fetched", 502);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase();
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new RecipeUrlImportError(
          "The URL does not point to an HTML page",
          415,
        );
      }
      return { html: await readLimitedText(response), url: url.toString() };
    }
  } catch (error) {
    if (error instanceof RecipeUrlImportError) throw error;
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeUrlImportError("The recipe page took too long to respond", 504);
    }
    throw new RecipeUrlImportError("The recipe page could not be fetched", 502);
  }

  throw new RecipeUrlImportError("The recipe page could not be fetched", 502);
}
