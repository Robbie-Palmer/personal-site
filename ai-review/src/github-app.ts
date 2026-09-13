import { createAppAuth } from "@octokit/auth-app";
import { JsonClient } from "ai-review-domain/reviewer";
import type { Env } from "./env";

const PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";
export const GITHUB_API_TIMEOUT_MS = 10_000;

type GitHubAppEnv = Pick<
  Env,
  | "AI_REVIEW_APP_ID"
  | "AI_REVIEW_APP_INSTALLATION_ID"
  | "AI_REVIEW_APP_PRIVATE_KEY"
>;

export function createGitHubAppAuth(options: {
  appId: string;
  installationId: string;
  privateKey: string;
}) {
  if (!options.privateKey.trimStart().startsWith(PKCS8_HEADER)) {
    throw new Error(
      "GitHub App private key must be unencrypted PKCS#8 PEM; convert GitHub's PKCS#1 download before deployment",
    );
  }
  return createAppAuth({
    appId: options.appId,
    installationId: Number(options.installationId),
    privateKey: options.privateKey,
  });
}

export async function createInstallationToken(options: {
  appId: string;
  installationId: string;
  privateKey: string;
}): Promise<string> {
  const auth = createGitHubAppAuth(options);
  const authentication = await auth({ type: "installation" });
  return authentication.token;
}

export function githubApiClientFromToken(
  token: string,
  options: { retries?: number } = {},
): JsonClient {
  return new JsonClient(
    "https://api.github.com",
    {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "personal-site-ai-review/1",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    { timeoutMs: GITHUB_API_TIMEOUT_MS, ...options },
  );
}

export async function githubApiClient(
  env: GitHubAppEnv,
  options: { retries?: number } = {},
): Promise<JsonClient> {
  const token = await createInstallationToken({
    appId: env.AI_REVIEW_APP_ID,
    installationId: env.AI_REVIEW_APP_INSTALLATION_ID,
    privateKey: env.AI_REVIEW_APP_PRIVATE_KEY,
  });
  return githubApiClientFromToken(token, options);
}
