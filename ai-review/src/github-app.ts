import { createAppAuth } from "@octokit/auth-app";

const PKCS8_HEADER = "-----BEGIN PRIVATE KEY-----";

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
