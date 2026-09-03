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

function removeStaleClaim(file: string, staleAfterMs: number, now: number): boolean {
  const recoveryLock = `${file}.recovery`;
  try {
    fs.mkdirSync(recoveryLock);
  } catch (error) {
    if (errorCode(error) === "EEXIST") return false;
    throw error;
  }
  try {
    const modifiedAt = claimModifiedAt(file);
    if (modifiedAt === null) return true;
    if (now - modifiedAt <= staleAfterMs) return false;
    fs.rmSync(file, { force: true });
    return true;
  } finally {
    fs.rmdirSync(recoveryLock);
  }
}

export function exclusiveClaim(file: string, staleAfterMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error("claim expiry must be a positive number of milliseconds");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < CLAIM_RECOVERY_ATTEMPTS; attempt += 1) {
    if (createClaimFile(file)) return true;
    if (!removeStaleClaim(file, staleAfterMs, now)) return false;
  }
  return false;
}
