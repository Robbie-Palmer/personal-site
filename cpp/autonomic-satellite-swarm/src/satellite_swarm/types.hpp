#ifndef SATELLITE_SWARM_TYPES_HPP
#define SATELLITE_SWARM_TYPES_HPP

#include <stdint.h>

namespace satellite_swarm {

using NodeId = uint8_t;
using MissionId = uint16_t;

constexpr NodeId kBroadcastNode = UINT8_MAX;
constexpr uint8_t kMaximumNodes = 16U;
constexpr uint8_t kMaximumCandidacyScore = 100U;

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

enum class MessageType : uint8_t {
  MissionRequest = 1,
  Candidacy = 2,
  Acknowledgement = 3,
  MissionAssignment = 4
};

struct Message {
  MessageType type = MessageType::MissionRequest;
  NodeId origin = 0U;
  NodeId target = kBroadcastNode;
  MissionId mission_id = 0U;
  Coordinate objective{};
  uint8_t score = 0U;

  Message() = default;

  static Message missionRequest(NodeId origin, MissionId mission_id, Coordinate objective);
  static Message candidacy(NodeId origin, NodeId leader, MissionId mission_id, uint8_t score);
  static Message acknowledgement(NodeId leader, NodeId candidate, MissionId mission_id);
  static Message assignment(NodeId leader, NodeId assignee, MissionId mission_id);
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
