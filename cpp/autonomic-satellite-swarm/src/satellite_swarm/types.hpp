#ifndef SATELLITE_SWARM_TYPES_HPP
#define SATELLITE_SWARM_TYPES_HPP

#include <stdint.h>

namespace satellite_swarm {

using NodeId = uint8_t;
using BootEpoch = uint32_t;
using MissionSequence = uint16_t;

constexpr NodeId kBroadcastNode = UINT8_MAX;
constexpr uint8_t kMaximumNodes = 16U;
constexpr uint8_t kMaximumCandidacyScore = 100U;

struct MissionKey {
  NodeId origin_node = kBroadcastNode;
  BootEpoch boot_epoch = 0U;
  MissionSequence sequence = 0U;

  MissionKey() = default;
  MissionKey(NodeId origin, BootEpoch epoch, MissionSequence mission_sequence)
      : origin_node(origin), boot_epoch(epoch), sequence(mission_sequence) {}
};

bool operator==(const MissionKey& left, const MissionKey& right);
bool operator!=(const MissionKey& left, const MissionKey& right);
bool isValid(const MissionKey& mission_key);

struct Coordinate {
  float longitude_degrees = 0.0F;
  float latitude_degrees = 0.0F;

  Coordinate() = default;
  Coordinate(float longitude, float latitude)
      : longitude_degrees(longitude), latitude_degrees(latitude) {}
};

bool isValid(const Coordinate& coordinate);

enum class TravelDirection : uint8_t { Northbound, Southbound };

struct SatelliteSnapshot {
  Coordinate coordinate{};
  float orbital_radius_metres = 6750000.0F;
  float mass_kilograms = 1.0F;
  float available_propulsion_energy_joules = 40000.0F;
  TravelDirection travel_direction = TravelDirection::Southbound;

  SatelliteSnapshot() = default;
};

bool isValid(const SatelliteSnapshot& satellite);

enum class MessageType : uint8_t {
  MissionRequest = 1,
  Candidacy = 2,
  Acknowledgement = 3,
  MissionAssignment = 4
};

struct Message {
  MessageType type = MessageType::MissionRequest;
  NodeId sender = 0U;
  NodeId target = kBroadcastNode;
  MissionKey mission_key{};
  Coordinate objective{};
  uint8_t score = 0U;

  Message() = default;

  static Message missionRequest(NodeId sender, MissionKey mission_key, Coordinate objective);
  static Message candidacy(NodeId sender, NodeId leader, MissionKey mission_key, uint8_t score);
  static Message acknowledgement(NodeId sender, NodeId candidate, MissionKey mission_key);
  static Message assignment(NodeId sender, NodeId assignee, MissionKey mission_key);
};

enum class HealthStatus : uint8_t { Nominal, Quiescent, Fatal };

enum class ControllerState : uint8_t {
  Idle,
  Leading,
  AwaitingAcknowledgement,
  AwaitingAssignment,
  Active,
  Quiescent,
  SafeDisabled
};

} // namespace satellite_swarm

#endif
