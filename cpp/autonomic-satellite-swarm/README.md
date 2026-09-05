# Autonomic Satellite Swarm

A revived research prototype for coordinating small satellite swarms and exploring fail-safe
behavior. The portable C++ core can run in a host simulation or behind Arduino hardware adapters.

The original prototype was called *Apoptotic Temporal Satellite Swarms*. This project accompanies
the 2019 paper [*Autonomic Providing Pre-Programmed Death of Cubesats
for Avoiding Space JUNK*](https://doi.org/10.1109/SMC-IT.2019.00015), by Robbie Palmer and Roy
Sterritt. It preserves the paper's proof-of-concept ideas while making their assumptions and limits
explicit.

> [!IMPORTANT]
> This is research and demonstration software, not flight software. "Apoptosis" means entering a
> latched safe-disabled software state. It does not physically destroy or deorbit a spacecraft. The
> included orbital score is a historical heuristic, not validated astrodynamics.

## What it demonstrates

- A temporary leader broadcasts a mission objective.
- Available nodes calculate a replaceable candidacy score.
- The leader acknowledges responses and deterministically assigns the strongest candidate.
- A busy node does not accept more work.
- Health policy can place a node into reversible quiescence or an irreversible safe-disabled state.
- Repeated failure to receive acknowledgements can trigger the historical "death by default" rule.

## Quick start

[mise](https://mise.jdx.dev/) pins the developer tools and exposes the supported commands:

```shell
mise trust
mise install
mise run test
mise run simulate
```

The simulation should assign the South-Pole mission to node 1:

```text
Mission 1 assigned to node 1
node 0: idle
node 1: active
node 2: idle
```

Run every host, firmware, formatting, lint, and spelling check with:

```shell
mise run check
```

`mise run coverage` also writes SonarQube's generic coverage report and rejects line coverage below
80%. The monorepo's SonarQube workflow imports that report alongside its JavaScript and Python
coverage.

## Architecture

```text
src/satellite_swarm/       portable state machine, policies, types, and wire codec
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

The Uno adapter uses four NEC infrared frames for each validated protocol packet. The ESP32 adapter
uses ESP-NOW broadcast packets. Both are compile-tested; neither has been exercised on physical
hardware during the revival because the original equipment is no longer available.

Node identity and initial coordinates are deliberately simple constants in each sketch. A real
deployment needs provisioned unique identities, calibrated health inputs, authenticated transport,
mission persistence, and a genuine guidance/navigation/control implementation.

## Documentation

- [Architecture](docs/architecture.md)
- [Wire protocol](docs/wire-protocol.md)
- [Revival notes and corrected defects](docs/revival-notes.md)
- [Next research cycle](docs/next-research-cycle.md)
- [Contributing](CONTRIBUTING.md)
