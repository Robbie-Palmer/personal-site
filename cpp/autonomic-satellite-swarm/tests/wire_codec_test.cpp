#include "satellite_swarm/wire_codec.hpp"

#include <array>
#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

using Catch::Matchers::WithinAbs;
using namespace satellite_swarm;

TEST_CASE("the wire codec round-trips every message field") {
  const Message original = Message::missionRequest(7, 0x1234, Coordinate(-123.45F, 67.89F));
  std::array<uint8_t, WireCodec::kPacketSize> packet{};

  REQUIRE(WireCodec::encode(original, packet.data(), packet.size()));
  REQUIRE(packet[0] == 0xA1);
  REQUIRE(packet[2] == 7);
  REQUIRE(packet[4] == 0x12);
  REQUIRE(packet[5] == 0x34);

  Message decoded;
  REQUIRE(WireCodec::decode(packet.data(), packet.size(), decoded));
  CHECK(decoded.type == MessageType::MissionRequest);
  CHECK(decoded.origin == 7);
  CHECK(decoded.target == kBroadcastNode);
  CHECK(decoded.mission_id == 0x1234);
  CHECK_THAT(decoded.objective.longitude_degrees, WithinAbs(-123.45F, 0.001F));
  CHECK_THAT(decoded.objective.latitude_degrees, WithinAbs(67.89F, 0.001F));
}

TEST_CASE("the wire codec rejects corrupted and invalid packets") {
  Message message = Message::candidacy(2, 1, 8, 73);
  std::array<uint8_t, WireCodec::kPacketSize> packet{};
  REQUIRE(WireCodec::encode(message, packet.data(), packet.size()));

  packet[10] ^= 0x01U;
  Message decoded;
  CHECK_FALSE(WireCodec::decode(packet.data(), packet.size(), decoded));
  CHECK_FALSE(WireCodec::decode(packet.data(), packet.size() - 1U, decoded));

  message.objective = Coordinate(181.0F, 0.0F);
  CHECK_FALSE(WireCodec::encode(message, packet.data(), packet.size()));

  message.objective = Coordinate();
  message.type = static_cast<MessageType>(99);
  CHECK_FALSE(WireCodec::encode(message, packet.data(), packet.size()));
}

TEST_CASE("message factories set routing semantics explicitly") {
  const Message candidacy = Message::candidacy(3, 1, 42, 88);
  CHECK(candidacy.type == MessageType::Candidacy);
  CHECK(candidacy.origin == 3);
  CHECK(candidacy.target == 1);
  CHECK(candidacy.mission_id == 42);
  CHECK(candidacy.score == 88);

  const Message assignment = Message::assignment(1, 3, 42);
  CHECK(assignment.type == MessageType::MissionAssignment);
  CHECK(assignment.origin == 1);
  CHECK(assignment.target == 3);
}
