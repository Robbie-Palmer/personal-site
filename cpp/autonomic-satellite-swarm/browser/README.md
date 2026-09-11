# Browser adapter

This directory exposes the deterministic simulation to the portfolio site by adapting the existing
C++ runner. The coordination algorithm remains in the portable core.

## Boundary

The exported C ABI has three functions:

- `satellite_swarm_browser_api_version()` reports the worker-facing API version.
- `satellite_swarm_run_demonstration(longitude, latitude)` runs the deterministic three-node trace
  and returns a pointer to its JSON result.
- `satellite_swarm_last_error()` returns the last adapter error when a run fails.

Returned pointers refer to adapter-owned strings and remain valid until the next call. The worker
copies each string into JavaScript before making another call. The adapter catches C++ exceptions so
none cross the C boundary.

The worker API, simulation trace, and JSON display record have independent version fields. A change
to one does not silently reinterpret either of the others.

## Build and parity check

Run the supported task from this project directory:

```shell
mise run browser:parity
```

The task pins Emscripten, configures the CMake browser target, copies its `.mjs` and `.wasm` outputs
to the site's public simulation directory, and runs the Node parity test. The test requires the
South Pole result to match the native fixture byte for byte. It also exercises a custom coordinate
and the error path.

The generated files are committed because the site's normal static build does not install a C++
toolchain. CI rebuilds them and fails when the checked artifacts drift.

## Browser lifecycle

The public module worker is loaded only when the simulation approaches the viewport. Each UI run
creates one worker, posts one versioned objective request, validates the response, and terminates the
worker. Aborting navigation also terminates it. This keeps Emscripten initialization and simulation
work off the page's main thread and prevents stale requests from replacing a newer result.

Cesium receives the validated snapshots after the run. It does not calculate candidate scores,
select an assignee, or update controller state.

## Deliberate limits

- The three node paths are scripted simulation inputs and provide no orbit propagation.
- The objective is the only caller-controlled input in this slice.
- The global result buffer assumes one call at a time, which matches the dedicated worker.
- The browser adapter may allocate memory. The portable coordination core and firmware constraints
  remain unchanged.
- WebAssembly parity covers the simulation result. It provides no evidence about radio timing,
  hardware behavior, or flight suitability.
