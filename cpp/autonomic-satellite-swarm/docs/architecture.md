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

The controller can be:

- idle;
- leading a mission negotiation;
- awaiting an acknowledgement;
- awaiting an assignment;
- active on a mission;
- quiescent; or
- safely disabled.

Safe-disabled is latched. Quiescence is reversible when the health monitor returns to nominal.

### Policies and ports

`Transport` sends and receives domain messages. Infrared, ESP-NOW, an in-memory simulation, or a
future radio can implement it without changing the state machine.

`HealthMonitor` owns the mapping from platform observations to health policy. The reference sketches
use a nominal monitor because there is no current hardware against which to calibrate thresholds.

`CandidacyScorer` owns mission suitability. `HistoricalOrbitalScorer` reproduces the paper's
heuristic and its example outputs, with validation and defined edge cases. A future flight-dynamics
model can replace it behind the same interface.

### Wire codec

`WireCodec` converts messages to a fixed 12-byte representation. It explicitly controls byte order,
coordinate quantization, versioning, and error detection. Adapters never send in-memory C++ object
layouts.

### Hardware adapters

The Arduino Uno adapter fragments one packet into four NEC infrared frames. It is the closest
maintainable equivalent of the original three-Arduino demonstration.

The ESP32 adapter sends the same packet through ESP-NOW. ESP-NOW is a convenient modern local radio
for a benchtop swarm demonstration; it is not proposed as a spacecraft communication link.

## Deliberate constraints

- Node IDs are currently `0..15`, with `255` reserved for broadcast.
- Candidate storage is statically bounded at 16 nodes.
- One controller negotiates one mission at a time.
- Mission IDs are local 16-bit counters and are not globally unique.
- The reference transport is unauthenticated and unencrypted.
- The controller holds a satellite snapshot; live navigation updates are future work.
- Multi-hop discovery and forwarding are out of scope for this revival.

These limits keep memory use and behavior deterministic. Changing one should begin with a requirement
and an architecture decision rather than an incidental code edit.

## Extension points

A credible next research iteration would add:

1. A validated orbital propagation and maneuver-cost model.
2. Bounded, prioritized telemetry for swarm-level observation and deterministic replay.
3. Fair, lifetime-aware allocation instead of a fixed node-ID tie-break.
4. A mission executor interface with progress, cancellation, and failure semantics, plus an
   idempotent platform hook for physical safe-state actions.
5. Persisted mission and safe-state transitions across reset.
6. Authenticated messages with replay protection before enabling remote intervention.
7. A simulator capable of packet loss, partitions, changing topology, and property-based invariants.
8. Hardware-in-the-loop tests for a selected board and radio.

The [next research cycle](next-research-cycle.md) develops these questions, including an observable
and governed improvement loop, without presenting them as current capabilities.
