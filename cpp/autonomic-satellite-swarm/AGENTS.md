# Project guide

## Intent

This repository is a research prototype, not flight software. Preserve the separation between the
portable coordination core and hardware adapters. Do not describe the historical orbital heuristic
as validated astrodynamics or the safe-disabled state as physical deorbiting.

## Commands

Use mise tasks rather than raw tool commands. Discover them with `mise tasks`.

- `mise run test`: host build and tests
- `mise run simulate`: deterministic three-node demonstration
- `mise run firmware:uno`: legacy Arduino Uno/infrared compile
- `mise run firmware:esp32`: modern ESP32/ESP-NOW compile
- `mise run check`: all quality gates

## Design constraints

- Keep `src/satellite_swarm` free of Arduino and operating-system dependencies.
- Keep wire fields fixed-width and encode them explicitly; never transmit C++ object layouts.
- Avoid dynamic allocation in the portable core and firmware adapters.
- Treat time comparisons as unsigned elapsed-time calculations so `millis()` rollover is safe.
- Add host-side tests for behavior changes before changing a state transition or wire field.
- Hardware builds prove compilation only until physical devices are available for integration tests.
