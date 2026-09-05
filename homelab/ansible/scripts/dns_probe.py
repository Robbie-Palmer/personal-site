#!/usr/bin/env python3
"""Send an A query to one DNS server and validate its response."""

from __future__ import annotations

import argparse
import secrets
import socket
import struct
import sys

DNS_HEADER_SIZE = 12
DNS_SERVER = "127.0.0.1"
DNS_ATTEMPTS = 2
RESPONSE_FLAG = 0x8000
TRUNCATED_FLAG = 0x0200


def normalize_name(name: str) -> bytes:
    """Return a lowercase IDNA name without its trailing root label."""
    return name.rstrip(".").encode("idna").lower()


def encode_name(name: str) -> bytes:
    """Encode a DNS name without compression."""
    labels = normalize_name(name).split(b".")
    if not labels or any(not label or len(label) > 63 for label in labels):
        raise ValueError("invalid DNS name")
    encoded = b"".join(bytes((len(label),)) + label for label in labels) + b"\0"
    if len(encoded) > 255:
        raise ValueError("DNS name exceeds 255 encoded bytes")
    return encoded


def decode_name(message: bytes, offset: int) -> tuple[bytes, int]:
    """Decode a possibly compressed DNS name and its next packet offset."""
    labels: list[bytes] = []
    next_offset: int | None = None
    visited_offsets: set[int] = set()

    while True:
        if offset >= len(message):
            raise ValueError("truncated DNS name")
        length = message[offset]
        offset += 1
        if length == 0:
            return b".".join(labels).lower(), next_offset or offset

        if length & 0xC0 == 0xC0:
            offset, next_offset = follow_compression_pointer(
                message, offset, length, next_offset, visited_offsets
            )
            continue
        if length & 0xC0:
            raise ValueError("invalid DNS label length")
        if length > 63 or offset + length > len(message):
            raise ValueError("truncated DNS label")
        labels.append(message[offset : offset + length])
        offset += length


def follow_compression_pointer(
    message: bytes,
    offset: int,
    first_byte: int,
    next_offset: int | None,
    visited_offsets: set[int],
) -> tuple[int, int]:
    """Resolve one DNS compression pointer and reject loops."""
    if offset >= len(message):
        raise ValueError("truncated DNS compression pointer")
    pointer = ((first_byte & 0x3F) << 8) | message[offset]
    if pointer in visited_offsets:
        raise ValueError("DNS compression pointer loop")
    visited_offsets.add(pointer)
    return pointer, next_offset or offset + 1


def validate_header(response: bytes, query_id: int) -> int:
    """Validate the DNS response header and return its answer count."""
    if len(response) < DNS_HEADER_SIZE:
        raise ValueError("short DNS response")

    response_id, flags, questions, answers, _, _ = struct.unpack(
        "!HHHHHH", response[:DNS_HEADER_SIZE]
    )
    if response_id != query_id or not flags & RESPONSE_FLAG:
        raise ValueError("mismatched DNS response")
    if flags & TRUNCATED_FLAG or flags & 0xF or questions != 1 or answers < 1:
        raise ValueError("DNS response did not contain an answer")
    return answers


def validate_question(response: bytes, expected_name: bytes) -> int:
    """Validate the echoed A question and return the answer offset."""
    question_name, offset = decode_name(response, DNS_HEADER_SIZE)
    if offset + 4 > len(response):
        raise ValueError("truncated DNS question")

    question_type, question_class = struct.unpack("!HH", response[offset : offset + 4])
    if question_name != expected_name or question_type != 1 or question_class != 1:
        raise ValueError("DNS response answered a different question")
    return offset + 4


def read_answer(response: bytes, offset: int) -> tuple[bytes, int, int, int, int]:
    """Read one answer and return its fields plus the next offset."""
    answer_name, offset = decode_name(response, offset)
    if offset + 10 > len(response):
        raise ValueError("truncated DNS answer")

    answer_type, answer_class, _, data_length = struct.unpack(
        "!HHIH", response[offset : offset + 10]
    )
    data_offset = offset + 10
    next_offset = data_offset + data_length
    if next_offset > len(response):
        raise ValueError("truncated DNS answer data")
    return answer_name, answer_type, answer_class, data_offset, next_offset


def has_matching_a_answer(
    response: bytes, offset: int, answers: int, expected_name: bytes
) -> bool:
    """Return whether the answers resolve the queried name to IPv4."""
    accepted_names = {expected_name}
    for _ in range(answers):
        answer_name, answer_type, answer_class, data_offset, offset = read_answer(
            response, offset
        )
        if answer_class != 1 or answer_name not in accepted_names:
            continue
        if answer_type == 1 and offset - data_offset == 4:
            return True
        if answer_type == 5:
            canonical_name, _ = decode_name(response, data_offset)
            accepted_names.add(canonical_name)
    return False


def validate_response(response: bytes, query_id: int, expected_name: bytes) -> int:
    """Validate the DNS header, echoed question, and matching A answer."""
    answers = validate_header(response, query_id)
    answer_offset = validate_question(response, expected_name)

    if not has_matching_a_answer(response, answer_offset, answers, expected_name):
        raise ValueError("DNS response did not contain a matching A answer")
    return answers


def query_once(name: str, timeout: float) -> int:
    """Send one DNS query and return its validated answer count."""
    query_id = secrets.randbits(16)
    encoded_name = encode_name(name)
    query = struct.pack("!HHHHHH", query_id, 0x0100, 1, 0, 0, 0)
    query += encoded_name + struct.pack("!HH", 1, 1)

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as dns_socket:
        dns_socket.settimeout(timeout)
        dns_socket.connect((DNS_SERVER, 53))
        dns_socket.send(query)
        response = dns_socket.recv(4096)

    return validate_response(response, query_id, normalize_name(name))


def probe(name: str, timeout: float) -> int:
    """Return the answer count, retrying once after packet loss."""
    for attempt in range(DNS_ATTEMPTS):
        try:
            return query_once(name, timeout)
        except TimeoutError:
            if attempt == DNS_ATTEMPTS - 1:
                raise
    raise AssertionError("DNS probe exhausted its attempts")


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--timeout", type=float, default=2.0)
    return parser.parse_args()


def main() -> int:
    """Run the probe and print its answer count."""
    args = parse_args()
    try:
        answers = probe(args.name, args.timeout)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(answers)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
