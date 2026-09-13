# Bounded telemetry

The portable controller records typed evidence about state transitions, mission negotiation,
mission outcomes, health changes, and transport failures. This is diagnostic evidence from a
research prototype. It is not a flight telemetry protocol.

Each controller owns a fixed 16-record queue. Recording and reading allocate no memory and do not
perform I/O. A hardware adapter can call `readTelemetry()` and choose when and how to transmit a
record. Failure to drain the queue never blocks coordination or health handling. The queue is
single-context code: it does not synchronize concurrent access, so an interrupt handler must not
read or record telemetry while the main loop is accessing it.

## Record identity

A record contains:

- the node ID, boot epoch, and a sequence number that starts at one for each controller boot;
- the controller's monotonic millisecond timestamp;
- the cumulative number of records dropped before this record was stored;
- a type, reason, and priority;
- the current mission key when one exists;
- the related node and a small event-specific value when needed; and
- the previous and current controller state.

The sequence advances for every attempted record, including a record rejected by a full queue.
Consumers can therefore detect a gap. `droppedTelemetryEvents()` exposes the count immediately,
even when no later record has entered the queue.

`CandidacySent` records cover both the initial successful transmission and successful retries. For
one mission and node, the first such record is the initial transmission and each later record is a
retry. Failed transmissions instead produce `TransportFailure` records.

Sequence zero is reserved. After record `4,294,967,295`, the buffer stops storing telemetry and
counts later attempts as drops, up to the saturating drop-counter limit. This preserves unique
record identities within a boot without widening every record on SRAM-constrained targets.
Controller coordination and health handling continue after exhaustion; a reboot with a new boot
epoch starts a new sequence.

## Admission under pressure

Telemetry has routine, operational, and critical priorities. When the queue is full, an incoming
record can displace the oldest record at the lowest priority beneath its own. Otherwise, the queue
drops the incoming record. Mission outcomes and entry into safe-disabled are critical, so routine
candidacy evidence cannot displace them.

This policy bounds storage and the work needed to admit one record. It does not yet rate-limit
records over time. A later hardware experiment must set transmission rates and byte budgets,
measure their effect on coordination traffic, and decide whether records need a separate wire
envelope. The current coordination wire format does not carry telemetry.

## Deterministic replay

The simulation drains every controller after each command or update and adds the records to its
ordered event stream. Browser schema version 4 exposes the same records and each node's cumulative
drop count. The replay log can now distinguish a state change inferred by the simulator from the
controller's own reason for that change.
