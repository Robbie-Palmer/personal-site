import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot read JSON ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value: string | NodeJS.ArrayBufferView): string {
  return createHash("sha256").update(value).digest("hex");
}

export function writeJson(file: string, value: unknown, stable = false): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = stable ? stableJson(value) : JSON.stringify(value, null, 2);
  fs.writeFileSync(file, `${content}\n`);
}

export function listJsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) throw new Error(`input directory does not exist: ${root}`);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(file);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export function resetDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

export function expandHome(value: string): string {
  if (value === "~") return process.env.HOME ?? value;
  if (value.startsWith("~/")) return path.join(process.env.HOME ?? "~", value.slice(2));
  return value;
}
