import fs from "node:fs";
import path from "node:path";

const CLAIM_RECOVERY_ATTEMPTS = 3;

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

function createClaimFile(file: string): boolean {
  try {
    fs.closeSync(fs.openSync(file, "wx"));
    return true;
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }
}

function claimModifiedAt(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

function removeStaleClaim(file: string, staleFile: string): boolean {
  try {
    fs.renameSync(file, staleFile);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
  fs.rmSync(staleFile, { force: true });
  return true;
}

export function exclusiveClaim(file: string, staleAfterMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error("claim expiry must be a positive number of milliseconds");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < CLAIM_RECOVERY_ATTEMPTS; attempt += 1) {
    if (createClaimFile(file)) return true;
    const modifiedAt = claimModifiedAt(file);
    if (modifiedAt === null) continue;
    if (now - modifiedAt <= staleAfterMs) return false;

    const staleFile = `${file}.stale-${process.pid}-${attempt}`;
    removeStaleClaim(file, staleFile);
  }
  return false;
}
