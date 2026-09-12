import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
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
const legacyCodex2 = recordOrEmpty(providerInstances["codex-personal"]);
const configuredCodex2 = recordOrEmpty(providerInstances.codex2);
const codex2 = { ...legacyCodex2, ...configuredCodex2 };
const codex2Config = {
  ...recordOrEmpty(legacyCodex2.config),
  ...recordOrEmpty(configuredCodex2.config),
};
const migratedProviderInstances = { ...providerInstances };
delete migratedProviderInstances["codex-personal"];

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
  ...migratedProviderInstances,
  codex2: {
    ...codex2,
    driver: "codex",
    displayName: "codex2",
    accentColor: codex2.accentColor ?? "#30eb25",
    enabled: codex2.enabled ?? true,
    config: {
      ...codex2Config,
      binaryPath: "codex",
      homePath: "/data/home/.codex",
      shadowHomePath: "/data/home/.codex-personal",
    },
  },
};

const temporaryPath = `${settingsPath}.tmp-${process.pid}`;
try {
  writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, settingsPath);
} finally {
  rmSync(temporaryPath, { force: true });
}
chmodSync(settingsPath, 0o600);
