# Next research cycle

**Status:** In progress. Bounded controller telemetry, rate-limited serial export, and deterministic
equal-score rotation are implemented; shared-radio budgets, resource evidence, and durable journals
remain proposed.

This document records research directions, not flight-software claims. The next cycle should make
autonomy observable and governable without making local coordination depend on a continuously
available ground link.

The separate [distributed-coordination research note](distributed-coordination-research.md) examines
the failure model behind that work. It connects the coordinated attack problem, FLP, Kafka's useful
limits, Delay-Tolerant Networking, protocol evolution, flown swarm experiments, and simulation
software to a staged test-bed plan.

## Observable autonomy

Each node should emit bounded, typed telemetry for:

- state transitions and their reasons;
- mission proposals, candidacy, assignment, progress, completion, and failure;
- health evidence rather than only the resulting health state;
- retries, packet loss estimates, and link failures;
- relevant energy, thermal, computation, storage, and actuator budgets; and
- safe-state requests, acceptance, execution, and results.

The controller now writes typed records to an allocation-free, non-blocking 16-record queue.
Records have per-boot sequence numbers, timestamps, priorities, stable mission keys, and cumulative
drop counts. Critical records can displace older lower-priority evidence. The deterministic
simulation drains the same queue used by firmware builds and includes the records in browser
replay. See [Bounded telemetry](telemetry.md) for the exact admission policy.

The portable transmitter now limits attempts, waits for platform-granted channel access, and retains
a record when its sink rejects publication. The reference adapters send one fixed telemetry frame
per second over a dedicated serial link after controller work. They do not send telemetry over IR or
ESP-NOW. A shared-radio policy still needs measured capacity and duty-cycle limits. Resource and
actuator evidence also await platform interfaces. Losing mission control does not stop local behavior
because the controller only enqueues records and never performs telemetry I/O.

## Mission-control observation and intervention

Mission control may itself be an autonomous observation system. It should build a swarm-level view,
detect correlated failures or inefficient plans that an individual node cannot see, and recommend
or initiate a bounded intervention when authorized.

Observation and command authority must remain separate. Before remote intervention is enabled, the
protocol needs authenticated identities, message integrity, replay protection, explicit command
authorization, an audit trail, and well-defined behavior during partitions. The current transport
provides none of these guarantees, so adding remote commands before that security work would create
more risk than useful control.

## Governed improvement loop

A self-improving system should improve through an evidence-driven release loop, not unconstrained
live modification of flight behavior:

1. Record bounded telemetry and reconstruct decisions in deterministic replay or a digital twin.
2. Produce candidate policy or planning changes outside the operational swarm.
3. Use independent adversarial reviewers to search for unsafe incentives, hidden coupling,
   resource exhaustion, and system-level regressions.
4. Check invariants with deterministic tests, property-based tests, fault injection, and simulation.
5. Evaluate changes in shadow mode and then a limited canary population.
6. Deploy an authenticated, versioned policy with explicit rollback criteria.

Evaluation must consider mission outcomes alongside energy, thermal and radiation exposure,
communication load, actuator use, remaining lifetime, and fair distribution of wear. Optimizing one
score alone invites reward hacking and can move risk between nodes without improving the swarm.

## Fair and resource-aware allocation

The controller now retains the highest-score rule and uses a mission-keyed cyclic order only among
equal top-scoring responders. It hashes the origin and boot epoch into a starting phase, while each
consecutive mission sequence advances one place. Six equal-score missions over three stable
responders produce two assignments per node in both native and WebAssembly runs. The simulator
derives that result from the leader's bounded assignment telemetry.

This is fair only within a stable tie. A higher score always wins, changing eligibility or scores
changes the rotation, and different leaders keep independent phases. The next policy experiment
should rank candidates by measured mission suitability and lifetime cost before applying the cyclic
tie-break. Useful evidence may include recent duty cycle, completed missions, energy reserves,
thermal margin, actuator budget, and cumulative wear. Each additional field has bandwidth, privacy,
trust, and spoofing costs that must be measured rather than assumed away.

## Physical safe-state action

The portable core should eventually expose a narrow platform hook for entering a physical safe
state. On the first transition to safe-disabled, it would make one idempotent request containing a
reason and correlation identifier. A hardware adapter could then inhibit an actuator, isolate a
payload, reduce power, change radio behavior, or take another platform-specific action.

The core should latch safe-disabled even if the adapter cannot complete the action. Mission control
should receive intent before execution when possible and a result afterward if a link survives.
Irreversible actuator behavior needs hardware-specific interlocks, fault injection, and physical
testing. This hook must never be described as deorbiting unless a separately validated subsystem
actually provides that capability.

## Adversarial questions

Experiments should actively test the failure modes introduced by these ideas:

- Does fault-time telemetry congestion consume the bandwidth or energy needed for recovery?
- Can a compromised observer spoof evidence, replay a command, or become a single point of failure?
- Can an event storm exhaust the fixed buffer or conceal the most important evidence?
- Does a fairness rule reduce mission success or merely redistribute measurable wear?
- Can incomplete or biased telemetry persuade an optimizer to choose a harmful policy?
- What happens when a safe-state actuator succeeds but its acknowledgement is lost?
- Do abstraction seams reduce change risk at an acceptable measured flash, RAM, and timing cost?

The answers should come from map files and timing measurements, lossy-network simulation,
deterministic replay, security analysis, and hardware-in-the-loop experiments when devices are
available.
