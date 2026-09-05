#ifndef SATELLITE_SWARM_TYPES_HPP
#define SATELLITE_SWARM_TYPES_HPP

#include <stdint.h>

namespace satellite_swarm {

typedef uint8_t NodeId;
typedef uint16_t MissionId;

const NodeId kBroadcastNode = UINT8_MAX;
const uint8_t kMaximumNodes = 16;

struct Coordinate {
  float longitude_degrees;
  float latitude_degrees;

  Coordinate(float longitude = 0.0F, float latitude = 0.0F)
      : longitude_degrees(longitude), latitude_degrees(latitude) {}
};

bool isValid(const Coordinate& coordinate);

enum class TravelDirection : uint8_t { Northbound, Southbound };

struct SatelliteSnapshot {
  Coordinate coordinate;
  float orbital_radius_metres;
  float mass_kilograms;
  float available_propulsion_energy_joules;
  TravelDirection travel_direction;

  SatelliteSnapshot()
      : coordinate(), orbital_radius_metres(6750000.0F), mass_kilograms(1.0F),
        available_propulsion_energy_joules(40000.0F),
        travel_direction(TravelDirection::Southbound) {}
};

enum class MessageType : uint8_t {
  MissionRequest = 1,
  Candidacy = 2,
  Acknowledgement = 3,
  MissionAssignment = 4
};

struct Message {
  MessageType type;
  NodeId origin;
  NodeId target;
  MissionId mission_id;
  Coordinate objective;
  uint8_t score;

  Message()
      : type(MessageType::MissionRequest), origin(0), target(kBroadcastNode), mission_id(0),
        objective(), score(0) {}

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
