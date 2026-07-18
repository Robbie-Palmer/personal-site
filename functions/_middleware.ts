/**
 * Serves the pre-generated Markdown twin of a page from its canonical URL
 * when the client asks for Markdown (via Accept header) or looks like an
 * agent/CLI tool that isn't requesting HTML. Appending `.md` to a page URL
 * always works without this middleware; this only makes it transparent.
 */

interface Env {
  ASSETS: { fetch: typeof fetch };
}

export interface MarkdownMiddlewareContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

const AGENT_USER_AGENTS =
  /\b(gptbot|chatgpt|oai-searchbot|claude|anthropic|perplexity|gemini|copilot|duckassist|cursor|devin|curl|wget|httpie|python-requests|python-httpx|aiohttp|go-http-client|axios|node-fetch|undici|got|libcurl|java\/|okhttp)\b/i;

function markdownPathFor(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized === "") return "/index.md";
  // Paths with a file extension (.md, .js, .png, ...) have no twin
  const lastSegment = normalized.slice(normalized.lastIndexOf("/") + 1);
  if (lastSegment.includes(".")) return null;
  return `${normalized}.md`;
}

export const onRequest = async (
  context: MarkdownMiddlewareContext,
): Promise<Response> => {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }
  if (url.pathname.startsWith("/ingest") || url.pathname.startsWith("/api")) {
    return context.next();
  }

  const markdownPath = markdownPathFor(url.pathname);
  if (!markdownPath) {
    return context.next();
  }

  const accept = request.headers.get("accept") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const wantsMarkdown =
    accept.includes("text/markdown") ||
    (!accept.includes("text/html") && AGENT_USER_AGENTS.test(userAgent));
  if (!wantsMarkdown) {
    return context.next();
  }

  const markdownUrl = new URL(markdownPath, url.origin);
  // Forward the original request (headers included) so conditional caching
  // (If-None-Match -> 304) keeps working for the negotiated Markdown
  const asset = await context.env.ASSETS.fetch(
    new Request(markdownUrl, {
      method: request.method,
      headers: request.headers,
      redirect: "manual",
    }),
  );
  if (!asset.ok && asset.status !== 304) {
    return context.next();
  }

  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", "Accept, User-Agent");
  headers.set("X-Markdown-Source", markdownUrl.toString());
  // Fetch forbids response bodies for 304 responses. Passing the asset's body
  // through here can throw at runtime even though the body will never be read.
  return new Response(asset.status === 304 ? null : asset.body, {
    status: asset.status,
    headers,
  });
};
