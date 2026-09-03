import fs from "node:fs";
import path from "node:path";

const CLAIM_RECOVERY_ATTEMPTS = 3;

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

export function exclusiveClaim(file: string, staleAfterMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error("claim expiry must be a positive number of milliseconds");
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < CLAIM_RECOVERY_ATTEMPTS; attempt += 1) {
    try {
      fs.closeSync(fs.openSync(file, "wx"));
      return true;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
    }

    let modifiedAt: number;
    try {
      modifiedAt = fs.statSync(file).mtimeMs;
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
    if (now - modifiedAt <= staleAfterMs) return false;

    const staleFile = `${file}.stale-${process.pid}-${attempt}`;
    try {
      fs.renameSync(file, staleFile);
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      throw error;
    }
    fs.rmSync(staleFile, { force: true });
  }
  return false;
}
