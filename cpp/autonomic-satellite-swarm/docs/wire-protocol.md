# Wire protocol

## Packet

Every semantic message is encoded into 12 bytes:

| Offset | Size | Field | Encoding |
| --- | ---: | --- | --- |
| 0 | 1 | Magic and version | `0xA1`: family `A`, version `1` |
| 1 | 1 | Message type | Request `1`, candidacy `2`, acknowledgement `3`, assignment `4` |
| 2 | 1 | Origin node | `0..15` in the current controller |
| 3 | 1 | Target node | Node ID or broadcast `255` |
| 4 | 2 | Mission ID | Unsigned, big-endian |
| 6 | 2 | Longitude | Signed centidegrees, big-endian |
| 8 | 2 | Latitude | Signed centidegrees, big-endian |
| 10 | 1 | Score | `0..100` |
| 11 | 1 | Checksum | CRC-8, polynomial `0x07`, over bytes `0..10` |

Coordinates are validated before encoding and after decoding. Fields unused by a message type are
zero. A packet with the wrong size, version, type, score range, coordinate range, or checksum is
rejected.

## Message flow

1. A leader broadcasts `MissionRequest(objective)`.
2. Each idle node sends `Candidacy(leader, score)` and retries until acknowledged.
3. The leader records the score and sends `Acknowledgement(candidate)`.
4. At the end of its bounded response window, the leader broadcasts
   `MissionAssignment(chosen_node)`.
5. The chosen node becomes active; other candidates return to idle.

The lowest node ID wins an equal score. This makes replayed simulations deterministic.

## Infrared framing

The Uno adapter splits the packet into four three-byte chunks. Each chunk is carried in a 32-bit NEC
raw frame whose high byte is `0xD0 | chunk_index`. The receiver accepts chunks `0..3`, resets on a new
chunk `0`, and discards incomplete packets after 250 ms. The packet CRC detects corruption and most
mixed assemblies.

## Security and reliability

CRC is error detection, not authentication. ESP-NOW broadcast and the infrared framing are
unauthenticated. The protocol also lacks replay protection, durable sequence state, forward error
correction, congestion control, and Byzantine behavior handling. Those omissions are acceptable for
a benchtop research prototype and unacceptable for a real command link.
