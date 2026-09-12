#ifndef SATELLITE_SWARM_SIMULATION_HPP
#define SATELLITE_SWARM_SIMULATION_HPP

#include "satellite_swarm/controller.hpp"

#include <stdint.h>
#include <vector>

namespace satellite_swarm::simulation {

constexpr uint8_t kSimulationTraceVersion = 2U;

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

enum class DeliveryFaultType : uint8_t { Drop, Delay, Duplicate };
enum class MessageDropReason : uint8_t { Scripted, LinkUnavailable };

// A directive applies once to the next matching sender-to-recipient delivery in its frame.
// A delayed delivery reaches the recipient on the first trace frame at or after deliver_at_ms.
struct DeliveryFault {
  NodeId sender = 0U;
  NodeId recipient = 0U;
  MessageType message_type = MessageType::MissionRequest;
  DeliveryFaultType type = DeliveryFaultType::Drop;
  uint32_t delay_ms = 0U;
};

struct LinkUpdate {
  NodeId sender = 0U;
  NodeId recipient = 0U;
  bool connected = true;
};

struct NodeReset {
  NodeId node_id = 0U;
};

struct SimulationFrame {
  uint32_t now_ms = 0U;
  std::vector<SatelliteUpdate> satellite_updates;
  std::vector<HealthUpdate> health_updates;
  // Link changes take effect before resets, delayed-message release, and controller updates.
  std::vector<LinkUpdate> link_updates;
  // Link availability takes precedence over a matching directive, which is still consumed.
  std::vector<DeliveryFault> delivery_faults;
  // Resets complete before due delayed messages are released to the replacement controller.
  std::vector<NodeReset> node_resets;
  std::vector<MissionCommand> mission_commands;
};

struct SimulationTrace {
  uint8_t version = kSimulationTraceVersion;
  ControllerConfig controller{};
  // Nodes must be non-empty, contiguous, and ordered by node_id.
  std::vector<NodeConfiguration> nodes;
  // Frames may be empty. Each time must advance by at most INT32_MAX ticks modulo 2^32.
  std::vector<SimulationFrame> frames;
};

enum class SimulationEventType : uint8_t {
  MissionCommand,
  MessageSent,
  MessageDropped,
  MessageDelayed,
  MessageDuplicated,
  DelayedMessageDelivered,
  LinkChanged,
  NodeReset,
  StateChanged
};

struct SimulationEvent {
  SimulationEventType type = SimulationEventType::StateChanged;
  uint32_t now_ms = 0U;
  NodeId node_id = 0U;
  NodeId recipient_node = kBroadcastNode;
  bool accepted = false;
  bool connected = true;
  uint32_t deliver_at_ms = 0U;
  MessageDropReason drop_reason = MessageDropReason::Scripted;
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
