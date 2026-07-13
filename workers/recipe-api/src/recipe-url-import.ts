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

function ipv4Groups(value: string): [number, number] | undefined {
  const octets = value.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return undefined;
  }
  const [first, second, third, fourth] = octets as [
    number,
    number,
    number,
    number,
  ];
  return [(first << 8) | second, (third << 8) | fourth];
}

function ipv6SideGroups(value: string): number[] | undefined {
  if (!value) return [];
  const parts = value.split(":");
  const groups: number[] = [];
  for (const [index, part] of parts.entries()) {
    if (part.includes(".")) {
      if (index !== parts.length - 1) return undefined;
      const tail = ipv4Groups(part);
      if (!tail) return undefined;
      groups.push(...tail);
      continue;
    }
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return undefined;
    groups.push(Number.parseInt(part, 16));
  }
  return groups;
}

function ipv6Groups(hostname: string): number[] | undefined {
  const sides = hostname.split("::");
  if (sides.length > 2) return undefined;
  const left = ipv6SideGroups(sides[0] ?? "");
  const right = ipv6SideGroups(sides[1] ?? "");
  if (!left || !right) return undefined;
  if (sides.length === 1) return left.length === 8 ? left : undefined;
  const omitted = 8 - left.length - right.length;
  if (omitted < 1) return undefined;
  return [...left, ...Array<number>(omitted).fill(0), ...right];
}

function isPrivateIpv6(hostname: string): boolean {
  const groups = ipv6Groups(hostname);
  if (!groups) return true;
  const [first, , , , , sixth, seventh, eighth] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const isUnspecifiedOrCompatible = groups
    .slice(0, 6)
    .every((group) => group === 0);
  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && sixth === 0xffff;
  const mappedIpv4 = `${seventh >> 8}.${seventh & 0xff}.${eighth >> 8}.${
    eighth & 0xff
  }`;
  return (
    isUnspecifiedOrCompatible ||
    (isIpv4Mapped && isPrivateIpv4(mappedIpv4)) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && groups[1] === 0x0db8)
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
    (hostname.includes(":") && isPrivateIpv6(hostname)) ||
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

function redirectUrl(
  response: Response,
  currentUrl: URL,
  redirectCount: number,
): URL | undefined {
  if (response.status < 300 || response.status >= 400) return undefined;
  const location = response.headers.get("location");
  if (!location) {
    throw new RecipeUrlImportError(
      "The recipe page returned a redirect without a destination",
      502,
    );
  }
  if (redirectCount === MAX_REDIRECTS) {
    throw new RecipeUrlImportError(
      "The recipe page redirected too many times",
      502,
    );
  }
  return validateRecipeUrl(new URL(location, currentUrl));
}

function validateRecipePageResponse(response: Response): void {
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
}

function rethrowFetchError(error: unknown): never {
  if (error instanceof RecipeUrlImportError) throw error;
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new RecipeUrlImportError(
      "The recipe page took too long to respond",
      504,
    );
  }
  throw new RecipeUrlImportError("The recipe page could not be fetched", 502);
}

export async function fetchRecipePage(
  rawUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<{ html: string; url: string }> {
  let url = validateRecipeUrl(rawUrl);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      // Cloudflare owns DNS resolution and egress enforcement for Workers fetch.
      // Literal and redirect targets are checked here; protection from a hostname
      // resolving to a private address relies on Cloudflare's network boundary.
      const response = await fetcher(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "RecipeImporter/1.0 (+https://robbiepalmer.me/recipes)",
        },
        redirect: "manual",
        signal,
      });
      const nextUrl = redirectUrl(response, url, redirect);
      if (nextUrl) {
        url = nextUrl;
        continue;
      }
      validateRecipePageResponse(response);
      return { html: await readLimitedText(response), url: url.toString() };
    }
  } catch (error) {
    rethrowFetchError(error);
  }

  throw new RecipeUrlImportError("The recipe page could not be fetched", 502);
}
