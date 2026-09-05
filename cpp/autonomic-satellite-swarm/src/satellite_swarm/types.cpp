#include "satellite_swarm/types.hpp"

#include <math.h>

namespace satellite_swarm {

bool isValid(const Coordinate& coordinate) {
  return isfinite(coordinate.longitude_degrees) && isfinite(coordinate.latitude_degrees) &&
         coordinate.longitude_degrees >= -180.0F && coordinate.longitude_degrees <= 180.0F &&
         coordinate.latitude_degrees >= -90.0F && coordinate.latitude_degrees <= 90.0F;
}

Message Message::missionRequest(NodeId origin, MissionId mission_id, Coordinate objective) {
  Message message;
  message.type = MessageType::MissionRequest;
  message.origin = origin;
  message.target = kBroadcastNode;
  message.mission_id = mission_id;
  message.objective = objective;
  return message;
}

Message Message::candidacy(NodeId origin, NodeId leader, MissionId mission_id, uint8_t score) {
  Message message;
  message.type = MessageType::Candidacy;
  message.origin = origin;
  message.target = leader;
  message.mission_id = mission_id;
  message.score = score;
  return message;
}

Message Message::acknowledgement(NodeId leader, NodeId candidate, MissionId mission_id) {
  Message message;
  message.type = MessageType::Acknowledgement;
  message.origin = leader;
  message.target = candidate;
  message.mission_id = mission_id;
  return message;
}

Message Message::assignment(NodeId leader, NodeId assignee, MissionId mission_id) {
  Message message;
  message.type = MessageType::MissionAssignment;
  message.origin = leader;
  message.target = assignee;
  message.mission_id = mission_id;
  return message;
}

} // namespace satellite_swarm
