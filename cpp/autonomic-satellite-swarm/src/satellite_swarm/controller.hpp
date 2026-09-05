#ifndef SATELLITE_SWARM_CONTROLLER_HPP
#define SATELLITE_SWARM_CONTROLLER_HPP

#include "satellite_swarm/interfaces.hpp"

#include <stdint.h>

namespace satellite_swarm {

struct ControllerConfig {
  uint32_t response_window_ms;
  uint32_t retry_interval_ms;
  uint8_t maximum_attempts;
  uint8_t failed_missions_before_safe_disable;
  uint8_t node_capacity;

  ControllerConfig()
      : response_window_ms(2000U), retry_interval_ms(250U), maximum_attempts(4),
        failed_missions_before_safe_disable(2), node_capacity(kMaximumNodes) {}
};

class SwarmController {
public:
  SwarmController(NodeId node_id, const SatelliteSnapshot& satellite, Transport& transport,
                  HealthMonitor& health_monitor, const CandidacyScorer& scorer,
                  const ControllerConfig& config = ControllerConfig());

  bool initiateMission(const Coordinate& objective, uint32_t now_ms);
  void update(uint32_t now_ms);
  void completeMission();

  ControllerState state() const { return state_; }
  NodeId nodeId() const { return node_id_; }
  MissionId currentMissionId() const { return current_mission_.mission_id; }
  NodeId assignedNode() const { return assigned_node_; }
  uint8_t consecutiveCommunicationFailures() const { return communication_failures_; }

private:
  struct Candidate {
    bool received;
    uint8_t score;
  };

  NodeId node_id_;
  SatelliteSnapshot satellite_;
  Transport& transport_;
  HealthMonitor& health_monitor_;
  const CandidacyScorer& scorer_;
  ControllerConfig config_;
  ControllerState state_;
  Message current_mission_;
  MissionId next_mission_id_;
  NodeId assigned_node_;
  uint32_t phase_started_at_ms_;
  uint32_t last_attempt_at_ms_;
  uint8_t attempts_;
  uint8_t communication_failures_;
  Candidate candidates_[kMaximumNodes];

  void resetCandidates();
  void process(const Message& message, uint32_t now_ms);
  void acceptMissionRequest(const Message& request, uint32_t now_ms);
  void sendCandidacy(uint32_t now_ms);
  void finishLeading();
  void abandonUnacknowledgedMission();
  bool matchesCurrentMission(const Message& message) const;
  bool elapsed(uint32_t now_ms, uint32_t since_ms, uint32_t duration_ms) const;
};

} // namespace satellite_swarm

#endif
