import { execFileSync } from "node:child_process";
import path from "node:path";

function git(repository: string, args: string[]): Buffer {
  try {
    return execFileSync("git", ["-C", repository, ...args], {
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { stderr?: Buffer; message?: string };
    const detail = failure.stderr?.toString("utf8").trim() || failure.message || "unknown error";
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
}

export function repositoryRoot(repository: string): string {
  const requested = path.resolve(repository);
  return git(requested, ["rev-parse", "--show-toplevel"]).toString("utf8").trim();
}

export function assertRevisionPair(
  repository: string,
  sourceRevision: string,
  publishedRevision: string,
): void {
  git(repository, ["cat-file", "-e", `${sourceRevision}^{commit}`]);
  git(repository, ["cat-file", "-e", `${publishedRevision}^{commit}`]);
  git(repository, ["merge-base", "--is-ancestor", sourceRevision, publishedRevision]);
}

export function revisionTimestamp(repository: string, revision: string): string {
  return git(repository, ["show", "-s", "--format=%cI", revision])
    .toString("utf8")
    .trim();
}

export function fileAtRevision(
  repository: string,
  revision: string,
  file: string,
): Buffer {
  const content = git(repository, ["show", `${revision}:${file}`]);
  new TextDecoder("utf-8", { fatal: true }).decode(content);
  return content;
}
