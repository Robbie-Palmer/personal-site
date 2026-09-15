# Work Graph CLI

`work-graph` is the installable Node.js client for the canonical Work Graph
REST API. Hey API generates its Fetch client, endpoint functions, request
types, response types, and Zod request schemas from
`workers/work-graph-api/openapi.json`. A tRPC command router composes those
generated schemas into the task-oriented CLI. trpc-cli derives argument
parsing, validation, nested commands, and help from that router, so command
inputs and help do not have separate handwritten definitions.

## Install

Build and pack the CLI from this repository:

```sh
mise //packages/work-graph-cli:build
cd packages/work-graph-cli
pnpm pack
npm install --global ./work-graph-cli-0.1.0.tgz
```

Node.js 22.18 or newer is required. The generated Fetch client and Zod schemas
are included in the package.

## Configure

Set the API URL in the environment or pass it before the command:

```sh
export WORK_GRAPH_API_URL=https://work-graph.example.com
work-graph queue

work-graph --api-url http://127.0.0.1:8787 queue
```

The CLI requires HTTPS except for `localhost`, `127.0.0.1`, and `[::1]`.

Set both Cloudflare Access service-token variables when the API is protected:

```sh
export CF_ACCESS_CLIENT_ID=example.access
export CF_ACCESS_CLIENT_SECRET=secret
export WORK_GRAPH_CF_ACCESS_ALLOWED_ORIGINS=https://work-graph.example.com
```

The allowlist accepts comma-separated exact origins. You can also repeat
`--cf-access-allowed-origin <origin>` before the command. When credentials are
present, the CLI refuses to make a request unless the API origin appears in
that allowlist. It never follows HTTP redirects. These two checks stop a changed
API URL or cross-origin redirect from receiving the Access headers. Credential
values are read only from the environment. The command parser has no credential
flags.

## Commands

Run `work-graph --help` for the compact command list. `queue` selects the
`ready` stage unless `--stage` or `--all` changes it. Lease duration defaults to
900 seconds. `claim` also reads `WORK_GRAPH_WORKER_ID` when `--worker-id` is
absent. Run `work-graph <command> --help` for schema-derived argument and option
help.

```sh
work-graph create cli-8 --title "Build the TypeScript CLI"
work-graph queue
work-graph queue --all --limit 100
work-graph claim --worker-id agent-a
work-graph claim cli-8 --worker-id agent-a
work-graph show cli-8
work-graph note cli-8 --lease-id "$LEASE_ID" --epoch 1 --content "HTTP tests pass"
work-graph renew "$LEASE_ID" --epoch 1 --lease-duration-seconds 600
work-graph release cli-8 --lease-id "$LEASE_ID" --epoch 1
work-graph cancel cli-8 --lease-id "$LEASE_ID" --epoch 1
```

Decomposition accepts contract-shaped JSON arrays. The optional child claim
gets a generated lease ID unless `--claim-lease-id` supplies one.

```sh
work-graph decompose parent-1 \
  --lease-id "$LEASE_ID" \
  --epoch 1 \
  --children-json '[{"id":"child-1","title":"First child","rank":1}]' \
  --dependencies-json '[]' \
  --claim-work-item-id child-1
```

Attention has three subcommands:

```sh
work-graph attention list
work-graph attention request cli-8 \
  --lease-id "$LEASE_ID" \
  --epoch 1 \
  --kind decision \
  --question "Which deployment target should I use?"
work-graph attention resolve "$ATTENTION_ID" --resolution "Use Cloudflare Workers"
```

`create`, `note`, `decompose`, `attention request`, and `attention resolve`
accept `--idempotency-key <uuid>`. Note and attention IDs are generated when
`--id` is absent.

## JSON and exit codes

Every completed command writes one compact JSON document to stdout. Errors
write one JSON document to stderr:

```json
{"error":{"code":"WORK_ITEM_NOT_FOUND","message":"Work item not found","status":404}}
```

Every command also accepts its complete Zod input through `--json`, which is
useful when an agent already has a structured object:

```sh
work-graph create --json '{"id":"cli-8","title":"Build the TypeScript CLI"}'
```

| Code | Meaning |
| ---: | --- |
| 0 | Success |
| 2 | Invalid arguments or unsafe configuration |
| 3 | Authentication or authorization failure, HTTP 401 or 403 |
| 4 | Resource not found, HTTP 404 |
| 5 | Work Graph state conflict, HTTP 409 |
| 6 | Request rejected, HTTP 400 or 422 |
| 7 | Work Graph server failure, HTTP 5xx |
| 8 | Network, redirect, malformed response, or other HTTP failure |

## Development

The normal build regenerates the SDK and request schemas before compiling:

```sh
mise //packages/work-graph-cli:build
```

Generate it directly after an API contract change, or run the same non-mutating
drift check used by CI:

```sh
mise //packages/work-graph-cli:openapi:generate
mise //packages/work-graph-cli:openapi:check
mise //packages/work-graph-cli:check
```

The Work Graph CI workflow runs both the API's canonical OpenAPI check and the
CLI check whenever either implementation or contract changes. CI fails when
the committed generated client or Zod schemas differ from a clean generation.
