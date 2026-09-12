import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const settingsPath = "/data/home/.t3/userdata/settings.json";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordOrEmpty(value) {
  return isRecord(value) ? value : {};
}

mkdirSync(dirname(settingsPath), { recursive: true });

let settings = {};
if (existsSync(settingsPath)) {
  const parsedSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!isRecord(parsedSettings)) {
    throw new Error(`${settingsPath} must contain a JSON object`);
  }
  settings = parsedSettings;
}

const providers = recordOrEmpty(settings.providers);
const providerInstances = recordOrEmpty(settings.providerInstances);
const personalCodex = recordOrEmpty(providerInstances["codex-personal"]);
const personalCodexConfig = recordOrEmpty(personalCodex.config);

settings.providers = {
  ...providers,
  grok: {
    ...recordOrEmpty(providers.grok),
    enabled: true,
  },
  opencode: {
    ...recordOrEmpty(providers.opencode),
    enabled: true,
  },
};

settings.providerInstances = {
  ...providerInstances,
  "codex-personal": {
    ...personalCodex,
    driver: "codex",
    displayName: personalCodex.displayName ?? "Codex personal",
    accentColor: personalCodex.accentColor ?? "#30eb25",
    enabled: personalCodex.enabled ?? true,
    config: {
      ...personalCodexConfig,
      binaryPath: "codex",
      homePath: "/data/home/.codex",
      shadowHomePath: "/data/home/.codex-personal",
    },
  },
};

const temporaryPath = `${settingsPath}.tmp-${process.pid}`;
writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
  mode: 0o600,
});
renameSync(temporaryPath, settingsPath);
chmodSync(settingsPath, 0o600);
