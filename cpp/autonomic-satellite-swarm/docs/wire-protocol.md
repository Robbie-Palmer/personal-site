# Wire protocol

## Mission identity

A mission key has three fields:

```text
{origin node, boot epoch, mission sequence}
```

The origin node is the durable node identity that created the mission. The 32-bit boot epoch must
change before that node creates messages after a reset. The 16-bit mission sequence starts at one
within an epoch. Zero is invalid for either numeric field. A controller stops creating missions
when it exhausts the sequence instead of wrapping to one.

This key names a mission. It does not prove that an assignment arrived or that its target started
work. Every message also carries its immediate sender because a candidacy sender differs from the
mission origin.

The simulator increments a node's boot epoch on reset. A real node must load and advance the epoch
from durable storage before constructing its controller. The reference firmware accepts a build-time
epoch for compile and bench use, so it does not yet provide reset-safe epoch management.

## Packet

Every semantic message is encoded into 18 bytes:

| Offset | Size | Field | Encoding |
| --- | ---: | --- | --- |
| 0 | 1 | Magic and version | `0xA2`: family `A`, version `2` |
| 1 | 1 | Message type | Request `1`, candidacy `2`, acknowledgement `3`, assignment `4` |
| 2 | 1 | Sender node | `0..15` in the current controller |
| 3 | 1 | Target node | Node ID or broadcast `255` |
| 4 | 1 | Mission origin node | `0..15` in the current controller |
| 5 | 4 | Mission boot epoch | Nonzero unsigned integer, big-endian |
| 9 | 2 | Mission sequence | Nonzero unsigned integer, big-endian |
| 11 | 2 | Longitude | Signed centidegrees, big-endian |
| 13 | 2 | Latitude | Signed centidegrees, big-endian |
| 15 | 1 | Score | `0..100` |
| 16 | 1 | Reserved | Must be zero |
| 17 | 1 | Checksum | CRC-8, polynomial `0x07`, over bytes `0..16` |

Coordinates and mission keys are validated before encoding and after decoding. Fields unused by a
message type are zero. A packet with the wrong size, version, type, score range, coordinate range,
reserved byte, mission key, or checksum is rejected. Version-one packets are not accepted because
their node-local mission ID cannot be mapped to a stable key after receipt.

## Message flow

1. A leader broadcasts `MissionRequest(key, objective)`.
2. Each idle node sends `Candidacy(key, leader, score)` and retries until acknowledged.
3. The leader records the score and sends `Acknowledgement(key, candidate)`.
4. At the end of its bounded response window, the leader broadcasts
   `MissionAssignment(key, chosen_node)`.
5. The chosen node becomes active; other candidates return to idle.

Every transition matches the complete mission key. An acknowledgement or assignment from an earlier
leader boot cannot complete a later negotiation that reused the same sequence.

The lowest node ID wins an equal score. This makes replayed simulations deterministic.

## Infrared framing

The Uno adapter splits the packet into six three-byte chunks. Each chunk is carried in a 32-bit NEC
raw frame whose high byte is `0xD0 | chunk_index`. The receiver accepts chunks `0..5`, resets on a new
chunk `0`, and discards incomplete packets after 250 ms. The packet CRC detects corruption and most
mixed assemblies.

## Security and reliability

CRC detects transmission errors. It provides no authentication. ESP-NOW broadcast and the infrared
framing are unauthenticated. The protocol also lacks replay storage, assignment confirmation,
durable boot-epoch management, forward error correction, congestion control, and Byzantine behavior
handling. Stable keys make replay detection possible; they do not provide it by themselves. Those
omissions are acceptable for a benchtop research prototype and unacceptable for a real command link.
