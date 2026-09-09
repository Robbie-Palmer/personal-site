#ifndef SATELLITE_SWARM_SIMULATION_HPP
#define SATELLITE_SWARM_SIMULATION_HPP

#include "satellite_swarm/controller.hpp"

#include <stdint.h>
#include <vector>

namespace satellite_swarm::simulation {

constexpr uint8_t kSimulationTraceVersion = 1U;

struct NodeConfiguration {
  NodeId node_id = 0U;
  SatelliteSnapshot satellite{};
};

struct SatelliteUpdate {
  NodeId node_id = 0U;
  SatelliteSnapshot satellite{};
};

struct HealthUpdate {
  NodeId node_id = 0U;
  HealthStatus health = HealthStatus::Nominal;
};

struct MissionCommand {
  NodeId leader = 0U;
  Coordinate objective{};
};

struct SimulationFrame {
  uint32_t now_ms = 0U;
  std::vector<SatelliteUpdate> satellite_updates;
  std::vector<HealthUpdate> health_updates;
  std::vector<MissionCommand> mission_commands;
};

struct SimulationTrace {
  uint8_t version = kSimulationTraceVersion;
  ControllerConfig controller{};
  std::vector<NodeConfiguration> nodes;
  std::vector<SimulationFrame> frames;
};

enum class SimulationEventType : uint8_t { MissionCommand, MessageSent, StateChanged };

struct SimulationEvent {
  SimulationEventType type = SimulationEventType::StateChanged;
  uint32_t now_ms = 0U;
  NodeId node_id = 0U;
  bool accepted = false;
  Coordinate objective{};
  Message message{};
  ControllerState previous_state = ControllerState::Idle;
  ControllerState current_state = ControllerState::Idle;
};

struct NodeObservation {
  NodeId node_id = 0U;
  ControllerState state = ControllerState::Idle;
  SatelliteSnapshot satellite{};
  MissionId mission_id = 0U;
  NodeId assigned_node = kBroadcastNode;
  uint8_t candidacy_score = 0U;
  uint8_t communication_failures = 0U;
};

struct FrameObservation {
  uint32_t now_ms = 0U;
  std::vector<NodeObservation> nodes;
};

struct SimulationResult {
  std::vector<SimulationEvent> events;
  std::vector<FrameObservation> frames;
};

// Throws std::invalid_argument when the trace is malformed or references an unknown node.
SimulationResult runSimulationTrace(const SimulationTrace& trace);

} // namespace satellite_swarm::simulation

#endif
