#!/usr/bin/env python3
"""Send an A query to one DNS server and validate its response."""

from __future__ import annotations

import argparse
import socket
import struct
import sys

DNS_HEADER_SIZE = 12
QUERY_ID = 0xA022
RESPONSE_FLAG = 0x8000
TRUNCATED_FLAG = 0x0200


def encode_name(name: str) -> bytes:
    """Encode a DNS name without compression."""
    labels = name.rstrip(".").encode("idna").split(b".")
    if not labels or any(not label or len(label) > 63 for label in labels):
        raise ValueError("invalid DNS name")
    return b"".join(bytes((len(label),)) + label for label in labels) + b"\0"


def probe(server: str, name: str, timeout: float) -> int:
    """Return the answer count from a successful DNS response."""
    query = struct.pack("!HHHHHH", QUERY_ID, 0x0100, 1, 0, 0, 0)
    query += encode_name(name) + struct.pack("!HH", 1, 1)

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as dns_socket:
        dns_socket.settimeout(timeout)
        dns_socket.sendto(query, (server, 53))
        response, _ = dns_socket.recvfrom(4096)

    if len(response) < DNS_HEADER_SIZE:
        raise ValueError("short DNS response")

    response_id, flags, questions, answers, _, _ = struct.unpack(
        "!HHHHHH", response[:DNS_HEADER_SIZE]
    )
    if response_id != QUERY_ID or not flags & RESPONSE_FLAG:
        raise ValueError("mismatched DNS response")
    if flags & TRUNCATED_FLAG or flags & 0xF or questions != 1 or answers < 1:
        raise ValueError("DNS response did not contain an answer")
    return answers


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--timeout", type=float, default=2.0)
    return parser.parse_args()


def main() -> int:
    """Run the probe and print its answer count."""
    args = parse_args()
    try:
        answers = probe(args.server, args.name, args.timeout)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(answers)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
