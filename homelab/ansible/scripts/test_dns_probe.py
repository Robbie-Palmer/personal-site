"""Tests for the standalone DNS health probe."""

from __future__ import annotations

import struct
import unittest

from dns_probe import encode_name, normalize_name, validate_response


class DnsProbeTests(unittest.TestCase):
    def test_normalizes_the_name_used_for_response_matching(self) -> None:
        self.assertEqual(normalize_name("Example.COM."), b"example.com")

    def test_accepts_matching_a_answer(self) -> None:
        query_id = 1234
        question = encode_name("example.com") + struct.pack("!HH", 1, 1)
        answer = b"\xc0\x0c" + struct.pack("!HHIH", 1, 1, 60, 4)
        answer += b"\xc0\x00\x02\x01"
        response = struct.pack("!HHHHHH", query_id, 0x8180, 1, 1, 0, 0)
        response += question + answer

        self.assertEqual(validate_response(response, query_id, b"example.com"), 1)

    def test_rejects_a_response_for_another_question(self) -> None:
        query_id = 1234
        question = encode_name("example.net") + struct.pack("!HH", 1, 1)
        answer = b"\xc0\x0c" + struct.pack("!HHIH", 1, 1, 60, 4)
        answer += b"\xc0\x00\x02\x01"
        response = struct.pack("!HHHHHH", query_id, 0x8180, 1, 1, 0, 0)
        response += question + answer

        with self.assertRaisesRegex(ValueError, "different question"):
            validate_response(response, query_id, b"example.com")

    def test_accepts_a_cname_followed_by_its_a_answer(self) -> None:
        query_id = 1234
        question = encode_name("example.com") + struct.pack("!HH", 1, 1)
        canonical_name = encode_name("alias.example.com")
        cname = b"\xc0\x0c" + struct.pack("!HHIH", 5, 1, 60, len(canonical_name))
        cname += canonical_name
        address = canonical_name + struct.pack("!HHIH", 1, 1, 60, 4)
        address += b"\xc0\x00\x02\x01"
        response = struct.pack("!HHHHHH", query_id, 0x8180, 1, 2, 0, 0)
        response += question + cname + address

        self.assertEqual(validate_response(response, query_id, b"example.com"), 2)

    def test_rejects_an_overlong_name(self) -> None:
        name = ".".join(["a" * 63] * 4)

        with self.assertRaisesRegex(ValueError, "exceeds 255"):
            encode_name(name)


if __name__ == "__main__":
    unittest.main()
