# Architecture

## Goals

The revival keeps the 2019 proof of concept understandable while allowing its hardware and research
assumptions to change independently. The core therefore owns coordination behavior, not pins,
radios, clocks, batteries, or orbital propagation.

## Components

### Portable coordination core

`SwarmController` is a deterministic, allocation-free state machine. Callers supply the current
32-bit monotonic time to `update`. Every timeout uses unsigned elapsed-time arithmetic, so the
calculation remains correct when Arduino `millis()` wraps.

Callers may replace the controller's latest validated `SatelliteSnapshot` before a simulation step
or navigation update. The controller exposes that same snapshot for observation and uses it when it
next calculates candidacy. Invalid coordinates, non-positive or non-finite radius, mass, or energy,
and unknown travel directions leave the last valid snapshot unchanged.

The controller can be:

- idle;
- leading a mission negotiation;
- awaiting an acknowledgement;
- awaiting an assignment;
- active on a mission;
- quiescent; or
- safely disabled.

Safe-disabled is latched for one controller lifetime. Quiescence is reversible when the health
monitor returns to nominal. The deterministic reset baseline records that constructing a replacement
controller clears safe-disabled because no durable state store exists yet.

### Policies and ports

`Transport` sends and receives domain messages. Infrared, ESP-NOW, an in-memory simulation, or a
future radio can implement it without changing the state machine.

`HealthMonitor` owns the mapping from platform observations to health policy. The reference sketches
use a nominal monitor because there is no current hardware against which to calibrate thresholds.

`CandidacyScorer` owns mission suitability. `HistoricalOrbitalScorer` reproduces the paper's
heuristic and its example outputs, with validation and defined edge cases. A future flight-dynamics
model can replace it behind the same interface.

### Wire codec

`WireCodec` converts messages to a fixed 18-byte representation. It explicitly controls byte order,
coordinate quantization, versioning, and error detection. Adapters never send in-memory C++ object
layouts. Each message separates its immediate sender from a stable mission key containing the
mission's origin node, that node's boot epoch, and a sequence within the epoch.

### Deterministic simulation

The simulation layer runs the portable controllers from a versioned sequence of fixed-time frames.
Each frame applies directed-link changes, explicit delivery faults, health and satellite updates,
and node resets before mission commands and controller updates. A delivery directive can drop,
delay, or duplicate the next matching sender-to-recipient message. The runner records each applied
fault alongside messages and state changes, then captures every node's state, score, and satellite
snapshot. The command-line demonstration uses this runner. An Emscripten target exposes the same
browser serializer through a versioned C ABI, and a module worker invokes it without moving
coordination rules into TypeScript. Native and WebAssembly results are compared byte for byte for
the default scenario. A reset increments the simulated node's boot epoch before constructing its
replacement controller.

### Hardware adapters

The Arduino Uno adapter fragments one packet into six NEC infrared frames. It is the closest
maintainable equivalent of the original three-Arduino demonstration.

The ESP32 adapter sends the same packet through ESP-NOW. ESP-NOW is a convenient modern local radio
for a benchtop swarm demonstration; it is not proposed as a spacecraft communication link.

## Deliberate constraints

- Node IDs are currently `0..15`, with `255` reserved for broadcast.
- Candidate storage is statically bounded at 16 nodes.
- Each update processes a configurable bounded number of received messages.
- One controller negotiates one mission at a time.
- Mission keys combine a provisioned node ID, a 32-bit boot epoch, and a 16-bit sequence. Sequence
  wrap is forbidden.
- The simulator advances boot epochs. The compile-tested firmware accepts a build-time epoch but has
  no durable epoch store.
- The reference transport is unauthenticated and unencrypted.
- The controller accepts snapshot updates but does not calculate or schedule them.
- Multi-hop discovery and forwarding are out of scope for this revival.

These limits keep memory use and behavior deterministic. Changing one should begin with a requirement
and an architecture decision rather than an incidental code edit.

## Extension points

A credible next research iteration would add:

1. A validated orbital propagation and maneuver-cost model.
2. Durable boot-epoch, assignment, and safe-state storage with explicit recovery rules.
3. Fair, lifetime-aware allocation instead of a fixed node-ID tie-break.
4. A mission executor interface with progress, cancellation, and failure semantics, plus an
   idempotent platform hook for physical safe-state actions.
5. Bounded, prioritized telemetry keyed by stable node and mission identity.
6. Authenticated messages with replay protection before enabling remote intervention.
7. Property-based and model-checked invariants beyond the deterministic regression scenarios.
8. Hardware-in-the-loop tests for a selected board and radio.

The [next research cycle](next-research-cycle.md) develops these questions, including an observable
and governed improvement loop, without presenting them as current capabilities.
