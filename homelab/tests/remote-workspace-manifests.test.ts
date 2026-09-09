import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseAllDocuments } from "yaml";

interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
  };
  [key: string]: unknown;
}

interface FluxSchemaReport {
  report: {
    summary: {
      total: number;
      valid: number;
      invalid: number;
      skipped: number;
    };
    results: Array<{
      status: string;
      reason?: string;
      violations?: Array<{ message: string; path: string }>;
    }>;
  };
}

const homelabDirectory = fileURLToPath(new URL("..", import.meta.url));
const overlays = {
  home: "k3s/overlays/home",
  remote: "k3s/overlays/remote-development",
  pilot: "k3s/overlays/remote-development-pilot",
} as const;
const renderedOverlays = new Map<string, string>();

function run(
  command: string,
  args: readonly string[],
  input?: string,
): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: homelabDirectory,
    encoding: "utf8",
    input,
    timeout: 30_000,
  });

  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\n${result.error?.message || result.stderr || result.stdout}`,
  );
  return { stdout: result.stdout, stderr: result.stderr };
}

function renderOverlay(overlay: string): string {
  const cached = renderedOverlays.get(overlay);
  if (cached !== undefined) {
    return cached;
  }

  const rendered = run("kubectl", ["kustomize", overlay]).stdout;
  renderedOverlays.set(overlay, rendered);
  return rendered;
}

function parseResources(overlay: string): KubernetesResource[] {
  return parseAllDocuments(renderOverlay(overlay)).map((document) => {
    assert.deepEqual(document.errors, [], `invalid YAML in ${overlay}`);
    const resource = document.toJS() as KubernetesResource;
    assert.equal(typeof resource.apiVersion, "string");
    assert.equal(typeof resource.kind, "string");
    assert.equal(typeof resource.metadata?.name, "string");
    return resource;
  });
}

function resource(
  resources: KubernetesResource[],
  kind: string,
  name: string,
  namespace?: string,
): KubernetesResource {
  const matches = resources.filter(
    (candidate) =>
      candidate.kind === kind &&
      candidate.metadata.name === name &&
      candidate.metadata.namespace === namespace,
  );
  assert.equal(
    matches.length,
    1,
    `expected one ${kind} ${namespace ? `${namespace}/` : ""}${name}, found ${matches.length}`,
  );
  return matches[0]!;
}

function valueAt(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value;

  for (const segment of path) {
    if (typeof segment === "number") {
      assert.ok(Array.isArray(current), `expected an array before index ${segment}`);
      assert.ok(segment in current, `missing array index ${segment}`);
      current = current[segment];
      continue;
    }

    assert.ok(
      typeof current === "object" && current !== null && segment in current,
      `missing field ${path.join(".")}`,
    );
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function kindCounts(resources: KubernetesResource[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(resources.map(({ kind }) => kind))]
      .sort()
      .map((kind) => [
        kind,
        resources.filter((resource) => resource.kind === kind).length,
      ]),
  );
}

const fluxSchemaArguments = [
  "validate",
  "--config",
  ".fluxschema.yml",
  "--output",
  "json",
] as const;

test("every rendered overlay passes the pinned Kubernetes and Doppler schemas", () => {
  for (const overlay of Object.values(overlays)) {
    const resources = parseResources(overlay);
    const result = run(
      "flux-schema",
      fluxSchemaArguments,
      renderOverlay(overlay),
    );
    const report = JSON.parse(result.stdout) as FluxSchemaReport;
    assert.deepEqual(report.report.summary, {
      total: resources.length,
      valid: resources.length,
      invalid: 0,
      skipped: 0,
    });
  }
});

test("Flux Schema evaluates the DopplerSecret CEL authentication rule", () => {
  const invalidDopplerSecret = `
apiVersion: secrets.doppler.com/v1alpha1
kind: DopplerSecret
metadata:
  name: invalid-authentication
spec:
  identity: 00000000-0000-0000-0000-000000000000
  tokenSecret:
    name: doppler-token
  managedSecret:
    name: t3-code-runtime
`;
  const result = spawnSync("flux-schema", fluxSchemaArguments, {
    cwd: homelabDirectory,
    encoding: "utf8",
    input: invalidDopplerSecret,
    timeout: 30_000,
  });

  assert.equal(result.status, 1, result.error?.message || result.stderr);
  const report = JSON.parse(result.stdout) as FluxSchemaReport;
  assert.deepEqual(report.report.summary, {
    total: 1,
    valid: 0,
    invalid: 1,
    skipped: 0,
  });
  assert.equal(report.report.results[0]?.reason, "cel-violation");
  assert.deepEqual(report.report.results[0]?.violations, [
    {
      path: "/spec",
      message:
        "Invalid value: Must specify either tokenSecret or identity, but not both",
    },
  ]);
});

test("the Doppler validation catalog matches the installed operator version", () => {
  const installer = readFileSync(
    new URL("../scripts/install-doppler-operator", import.meta.url),
    "utf8",
  );
  const validationConfig = readFileSync(
    new URL("../.fluxschema.yml", import.meta.url),
    "utf8",
  );
  const installedVersion = installer.match(
    /kubernetes-operator\/releases\/download\/(v\d+\.\d+\.\d+)\//,
  );
  const schemaVersion = validationConfig.match(
    /k3s\/schemas\/doppler-operator-(v\d+\.\d+\.\d+)/,
  );

  assert.ok(installedVersion, "the Doppler Operator URL must pin a version");
  assert.ok(schemaVersion, "the Doppler schema catalog must pin a version");
  assert.equal(schemaVersion[1], installedVersion[1]);
});

test("the pilot overlay renders two distinct workspaces", () => {
  const resources = parseResources(overlays.pilot);

  assert.deepEqual(kindCounts(resources), {
    Deployment: 2,
    DopplerSecret: 2,
    Namespace: 2,
    NetworkPolicy: 3,
    PersistentVolume: 2,
    PersistentVolumeClaim: 2,
    PriorityClass: 1,
    ResourceQuota: 1,
    Service: 2,
    ServiceAccount: 2,
  });

  const identities = resources.map(
    ({ apiVersion, kind, metadata }) =>
      `${apiVersion}:${kind}:${metadata.namespace ?? "cluster"}:${metadata.name}`,
  );
  assert.equal(
    new Set(identities).size,
    identities.length,
    "rendered resources must have unique identities",
  );

  const operatorService = resource(resources, "Service", "t3-code", "t3-code");
  const pilotService = resource(
    resources,
    "Service",
    "t3-code",
    "t3-code-pilot",
  );
  assert.equal(
    valueAt(operatorService, ["spec", "ports", 0, "nodePort"]),
    30773,
  );
  assert.equal(valueAt(pilotService, ["spec", "ports", 0, "nodePort"]), 30774);

  const operatorVolume = resource(
    resources,
    "PersistentVolume",
    "t3-code-remote-development",
  );
  const pilotVolume = resource(
    resources,
    "PersistentVolume",
    "t3-code-remote-development-pilot",
  );
  assert.equal(
    valueAt(operatorVolume, ["spec", "local", "path"]),
    "/srv/remote-development/t3-code",
  );
  assert.equal(
    valueAt(pilotVolume, ["spec", "local", "path"]),
    "/srv/remote-development/t3-code-pilot",
  );
  for (const volume of [operatorVolume, pilotVolume]) {
    assert.deepEqual(
      valueAt(volume, [
        "spec",
        "nodeAffinity",
        "required",
        "nodeSelectorTerms",
        0,
        "matchExpressions",
      ]),
      [
        {
          key: "homelab.dev/location",
          operator: "In",
          values: ["cloud"],
        },
        {
          key: "homelab.dev/capability",
          operator: "In",
          values: ["agent-workspace"],
        },
        {
          key: "kubernetes.io/hostname",
          operator: "In",
          values: ["remote-development"],
        },
      ],
    );
  }

  const operatorClaim = resource(
    resources,
    "PersistentVolumeClaim",
    "t3-code-data",
    "t3-code",
  );
  const pilotClaim = resource(
    resources,
    "PersistentVolumeClaim",
    "t3-code-data",
    "t3-code-pilot",
  );
  assert.equal(
    valueAt(operatorClaim, ["spec", "volumeName"]),
    "t3-code-remote-development",
  );
  assert.equal(
    valueAt(pilotClaim, ["spec", "volumeName"]),
    "t3-code-remote-development-pilot",
  );

  const operatorDeployment = resource(
    resources,
    "Deployment",
    "t3-code",
    "t3-code",
  );
  const pilotDeployment = resource(
    resources,
    "Deployment",
    "t3-code",
    "t3-code-pilot",
  );
  assert.equal(valueAt(pilotDeployment, ["spec", "strategy", "type"]), "Recreate");
  assert.deepEqual(
    valueAt(operatorDeployment, [
      "spec",
      "template",
      "spec",
      "containers",
      0,
      "resources",
    ]),
    {
      limits: { cpu: "3", memory: "6Gi" },
      requests: { cpu: "500m", memory: "1Gi" },
    },
  );
  assert.deepEqual(
    valueAt(pilotDeployment, [
      "spec",
      "template",
      "spec",
      "containers",
      0,
      "resources",
    ]),
    {
      limits: { cpu: "1", memory: "1Gi" },
      requests: { cpu: "250m", memory: "512Mi" },
    },
  );
  assert.equal(
    valueAt(pilotDeployment, ["spec", "template", "spec", "priorityClassName"]),
    "pilot-workspace",
  );
  assert.deepEqual(
    valueAt(pilotDeployment, [
      "spec",
      "template",
      "spec",
      "containers",
      0,
      "envFrom",
      0,
    ]),
    { secretRef: { name: "t3-code-runtime", optional: false } },
  );
  assert.equal(
    valueAt(pilotDeployment, [
      "spec",
      "template",
      "spec",
      "automountServiceAccountToken",
    ]),
    false,
  );
  assert.deepEqual(
    valueAt(pilotDeployment, ["spec", "template", "spec", "securityContext"]),
    {
      fsGroup: 2000,
      fsGroupChangePolicy: "OnRootMismatch",
      runAsGroup: 2000,
      runAsNonRoot: true,
      runAsUser: 2000,
      seccompProfile: { type: "RuntimeDefault" },
    },
  );
  assert.deepEqual(
    valueAt(pilotDeployment, [
      "spec",
      "template",
      "spec",
      "containers",
      0,
      "securityContext",
    ]),
    {
      allowPrivilegeEscalation: false,
      capabilities: { drop: ["ALL"] },
      readOnlyRootFilesystem: true,
    },
  );
  assert.deepEqual(
    valueAt(pilotDeployment, ["spec", "template", "spec", "volumes", 1]),
    { emptyDir: { sizeLimit: "1Gi" }, name: "tmp" },
  );

  const quota = resource(
    resources,
    "ResourceQuota",
    "workspace",
    "t3-code-pilot",
  );
  assert.deepEqual(valueAt(quota, ["spec", "hard"]), {
    "limits.cpu": "1",
    "limits.memory": "1Gi",
    persistentvolumeclaims: "1",
    pods: "1",
    "requests.cpu": "1",
    "requests.memory": "1Gi",
    "requests.storage": "10Gi",
  });

  const priority = resource(resources, "PriorityClass", "pilot-workspace");
  assert.equal(valueAt(priority, ["value"]), -10);
  assert.equal(valueAt(priority, ["preemptionPolicy"]), "Never");

  const policyNames = resources
    .filter(({ kind }) => kind === "NetworkPolicy")
    .map(({ metadata }) => metadata.name)
    .sort();
  assert.deepEqual(policyNames, [
    "workspace-default-deny-ingress",
    "workspace-dns",
    "workspace-public-egress",
  ]);

  const pilotSecret = resource(
    resources,
    "DopplerSecret",
    "t3-code",
    "t3-code-pilot",
  );
  assert.equal(
    valueAt(pilotSecret, ["spec", "config"]),
    "prd_remote_development_pilot",
  );
  assert.equal(
    valueAt(pilotSecret, ["spec", "managedSecret", "namespace"]),
    "t3-code-pilot",
  );
});

test("the default remote overlay contains only the operator workspace", () => {
  const resources = parseResources(overlays.remote);

  assert.deepEqual(kindCounts(resources), {
    Deployment: 1,
    DopplerSecret: 1,
    Namespace: 1,
    PersistentVolume: 1,
    PersistentVolumeClaim: 1,
    Service: 1,
    ServiceAccount: 1,
  });
  assert.ok(
    resources.every(({ metadata }) => metadata.namespace !== "t3-code-pilot"),
  );
  assert.ok(
    resources.every(({ metadata }) => !metadata.name.includes("pilot")),
  );
});

test("the NixOS host publishes, prepares, and limits both workspace paths", () => {
  const hostDefinition = readFileSync(
    new URL("../hosts/remote-development/default.nix", import.meta.url),
    "utf8",
  );

  assert.ok(
    hostDefinition.includes(
      "tailscale serve --bg --https=443 http://127.0.0.1:30773",
    ),
  );
  assert.ok(
    hostDefinition.includes(
      "tailscale serve --bg --https=8443 http://127.0.0.1:30774",
    ),
  );
  assert.ok(
    hostDefinition.includes(
      "install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/home/.codex",
    ),
  );
  assert.ok(
    hostDefinition.includes(
      "install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/workspaces",
    ),
  );
  assert.ok(hostDefinition.includes('"prjquota"'));
  assert.ok(hostDefinition.includes('pilotProjectId = "2001"'));
  assert.ok(hostDefinition.includes('pilotBlockHardLimit = "10G"'));
  assert.ok(hostDefinition.includes('pilotInodeHardLimit = "1000000"'));
  assert.ok(hostDefinition.includes('containerLogMaxFiles = 3'));
  assert.ok(hostDefinition.includes('containerLogMaxSize = "20Mi"'));
  assert.ok(
    hostDefinition.includes(
      "chattr -R -p ${pilotProjectId} ${pilotDataPath}",
    ),
  );
  assert.ok(hostDefinition.includes("chattr +P ${pilotDataPath}"));
  assert.ok(
    hostDefinition.includes(
      "setquota --project ${pilotProjectId} 0 ${pilotBlockHardLimit} 0 ${pilotInodeHardLimit} ${dataMount}",
    ),
  );
  assert.ok(
    hostDefinition.includes('"remote-development-project-quotas.service"'),
  );

  const volumePreparation = readFileSync(
    new URL("../scripts/prepare-remote-development-volume", import.meta.url),
    "utf8",
  );
  assert.ok(volumePreparation.includes("-O project,quota"));
  assert.ok(volumePreparation.includes("-E quotatype=prjquota"));
});
