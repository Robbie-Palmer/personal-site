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

export function resetDirectory(directory: string): void {
  const resolved = path.resolve(directory);
  if (resolved === path.parse(resolved).root || resolved === path.resolve(".")) {
    throw new Error(`refusing to reset unsafe output directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
