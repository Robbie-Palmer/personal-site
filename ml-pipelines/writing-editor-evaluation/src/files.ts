import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "writing-editor-domain/canonical-json";

export function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot read JSON ${file}: ${errorMessage(error)}`);
  }
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${canonicalJson(value)}\n`);
}

export function resetDirectory(directory: string, allowedRoot: string): void {
  const resolved = path.resolve(directory);
  const root = path.resolve(allowedRoot);
  const relative = path.relative(root, resolved);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`refusing to reset unsafe output directory: ${resolved}`);
  }
  assertNoSymlinkComponents(root, relative);
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function assertNoSymlinkComponents(root: string, relative: string): void {
  let current = root;
  for (const segment of ["", ...relative.split(path.sep)]) {
    current = path.join(current, segment);
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`refusing to reset output through symbolic link: ${current}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
