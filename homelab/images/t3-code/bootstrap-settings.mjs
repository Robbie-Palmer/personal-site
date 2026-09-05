import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const settingsPath = process.argv[2];

if (!settingsPath) {
  throw new Error("usage: bootstrap-settings.mjs <settings-path>");
}

mkdirSync(dirname(settingsPath), { recursive: true });

let settings = {};
if (existsSync(settingsPath)) {
  settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (settings === null || Array.isArray(settings) || typeof settings !== "object") {
    throw new Error(`${settingsPath} must contain a JSON object`);
  }
}

const providers =
  settings.providers !== null &&
  !Array.isArray(settings.providers) &&
  typeof settings.providers === "object"
    ? settings.providers
    : {};

settings.providers = {
  ...providers,
  grok: {
    ...(providers.grok ?? {}),
    enabled: true,
  },
  opencode: {
    ...(providers.opencode ?? {}),
    enabled: true,
  },
};

const temporaryPath = `${settingsPath}.tmp-${process.pid}`;
writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
  mode: 0o600,
});
renameSync(temporaryPath, settingsPath);
chmodSync(settingsPath, 0o600);
