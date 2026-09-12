# Autonomic Satellite Swarm

A revived research prototype for coordinating small satellite swarms and exploring fail-safe
behavior. The portable C++ core can run in a host simulation, in a browser through WebAssembly, or
behind Arduino hardware adapters.

The original prototype was called *Apoptotic Temporal Satellite Swarms*. This project accompanies
the 2019 paper [*Autonomic Providing Pre-Programmed Death of Cubesats
for Avoiding Space JUNK*](https://doi.org/10.1109/SMC-IT.2019.00015), by Robbie Palmer and Roy
Sterritt. It preserves the paper's proof-of-concept ideas while making their assumptions and limits
explicit.

> [!IMPORTANT]
> This is research and demonstration software, not flight software. "Apoptosis" means entering a
> safe-disabled software state that is latched until the controller resets. It does not physically
> destroy or deorbit a spacecraft. The included orbital score is a historical heuristic, not
> validated astrodynamics.

## What it demonstrates

- A temporary leader broadcasts a mission objective.
- Available nodes calculate a replaceable candidacy score.
- The leader acknowledges responses and deterministically assigns the strongest candidate.
- A busy node does not accept more work.
- Health policy can place a node into reversible quiescence or a safe-disabled state latched for the controller lifetime.
- Repeated failure to receive acknowledgements can trigger the historical "death by default" rule.
- Deterministic trace inputs can drop, delay, or duplicate deliveries, change directed links, and
  reset a node so protocol failures can be replayed exactly.
- Missions use `{origin node, boot epoch, mission sequence}` keys, so messages from different nodes
  or leader boots cannot alias the same mission.

## Quick start

[mise](https://mise.jdx.dev/) pins the developer tools and exposes the supported commands:

```shell
mise trust
mise install
mise run test
mise run simulate
mise run simulate:json
```

The simulation should assign the southern-latitude mission to node 1:

```text
Mission 0:1:1 assigned to node 1
node 0: idle
node 1: active
node 2: idle
```

The [browser demonstration](https://robbiepalmer.me/satellite-swarm) runs the portable controller
as WebAssembly in a module worker and draws the result on a self-hosted CesiumJS globe.

`simulate:json` prints the versioned state, position, message, transition, and network-fault record
consumed by the CesiumJS view. The paths come from scripted simulation inputs. Orbit propagation
remains outside this demo. The browser can compare the connected mission with a run where node 1's
winning assignment is dropped.

Build the browser module and compare its default output with the native fixture:

```shell
mise run browser:parity
```

The task pins Emscripten, writes the untracked deployable `.mjs` and `.wasm` files under `ui/public`,
checks a custom objective, and verifies invalid-input handling. The UI build runs the same task so
deployments compile the browser module from source. The worker API is versioned separately from the
simulation trace and display schema.

Run every host, firmware, formatting, lint, and spelling check with:

```shell
mise run check
```

`mise run coverage` also writes SonarQube's generic coverage report and rejects line coverage below
80% or branch coverage below 70%. The monorepo's SonarQube workflow imports that report alongside
its JavaScript and Python coverage.

## Architecture

```text
src/satellite_swarm/       portable state machine, policies, types, and wire codec
simulation/                 deterministic trace runner and observable simulation state
browser/                    C ABI, Emscripten entry point, and native/WASM parity test
examples/simulation/       deterministic host-side three-node demonstration
firmware/uno_ir/           legacy Arduino Uno + infrared reference adapter
firmware/esp32_espnow/     modern ESP32 + ESP-NOW reference adapter
tests/                     host-side behavior and characterization tests
docs/                      architecture, protocol, and modernization notes
```

The core depends on three interfaces:

- `Transport` moves semantic messages without exposing radio details.
- `HealthMonitor` maps platform observations to nominal, quiescent, or fatal health.
- `CandidacyScorer` ranks a satellite for a mission objective.

See [Architecture](docs/architecture.md) and [Wire protocol](docs/wire-protocol.md) for the detailed
contracts.

## Firmware builds

The Arduino CLI profiles pin platform and library versions and download them into isolated build
profiles:

```shell
mise run firmware:uno
mise run firmware:esp32
```

The Uno adapter uses six NEC infrared frames for each validated protocol packet. The ESP32 adapter
uses ESP-NOW broadcast packets. Both are compile-tested; neither has been exercised on physical
hardware during the revival because the original equipment is no longer available.

The compile checks use reference node ID `0`. Set a distinct ID for each physical board at build
time; the task rejects values outside the core's configured `0..15` range:

```shell
SATELLITE_SWARM_NODE_ID=2 mise run firmware:uno
SATELLITE_SWARM_NODE_ID=2 mise run firmware:esp32
```

The firmware build accepts `SATELLITE_SWARM_BOOT_EPOCH`, which defaults to `1` for compile and bench
use. A real deployment must advance that value in durable storage before the controller starts after
a reset. Initial coordinates remain deliberately simple constants in each sketch. A real deployment
also needs calibrated health inputs, authenticated transport with replay protection, mission
persistence, and a genuine guidance/navigation/control implementation.

## Documentation

- [Architecture](docs/architecture.md)
- [Wire protocol](docs/wire-protocol.md)
- [Coordination invariant baseline](docs/invariant-baseline.md)
- [Revival notes and corrected defects](docs/revival-notes.md)
- [Next research cycle](docs/next-research-cycle.md)
- [Distributed coordination over intermittent links](docs/distributed-coordination-research.md)
- [Contributing](CONTRIBUTING.md)
