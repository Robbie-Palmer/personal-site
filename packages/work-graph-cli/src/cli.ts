#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DOPPLER_BOOTSTRAP_MARKER,
  dopplerBootstrapArgs,
} from "./bootstrap.js";
import { runCli } from "./main.js";

const args = process.argv.slice(2);
const bootstrapArgs = dopplerBootstrapArgs(
  args,
  process.env,
  process.execPath,
  fileURLToPath(import.meta.url),
);

if (bootstrapArgs === undefined) {
  process.exitCode = await runCli(args);
} else {
  const child = spawnSync("doppler", bootstrapArgs, {
    env: { ...process.env, [DOPPLER_BOOTSTRAP_MARKER]: "1" },
    stdio: "inherit",
  });
  const dopplerMissing =
    child.error !== undefined &&
    "code" in child.error &&
    child.error.code === "ENOENT";
  process.exitCode =
    dopplerMissing ? await runCli(args) : (child.status ?? 1);
}
