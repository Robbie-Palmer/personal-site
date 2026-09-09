#include "satellite_swarm/simulation.hpp"

#include "satellite_swarm/historical_orbital_scorer.hpp"

#include <cstddef>
#include <deque>
#include <memory>
#include <stdexcept>
#include <utility>
#include <vector>

namespace satellite_swarm::simulation {
namespace {

class SimulationTransport;

class SimulationBus {
public:
  explicit SimulationBus(std::vector<SimulationEvent>& events) : events_(events) {}

  void attach(SimulationTransport& transport);
  void setTime(uint32_t now_ms) { now_ms_ = now_ms; }
  void broadcast(NodeId sender, const Message& message);

private:
  std::vector<SimulationTransport*> transports_;
  std::vector<SimulationEvent>& events_;
  uint32_t now_ms_ = 0U;
};

class SimulationTransport : public Transport {
public:
  SimulationTransport(NodeId node_id, SimulationBus& bus) : node_id_(node_id), bus_(bus) {
    bus_.attach(*this);
  }

  bool send(const Message& message) override {
    bus_.broadcast(node_id_, message);
    return true;
  }

  bool receive(Message& message) override {
    if (inbox_.empty()) {
      return false;
    }
    message = inbox_.front();
    inbox_.pop_front();
    return true;
  }

  NodeId nodeId() const { return node_id_; }
  void deliver(const Message& message) { inbox_.push_back(message); }

private:
  NodeId node_id_;
  SimulationBus& bus_;
  std::deque<Message> inbox_;
};

void SimulationBus::attach(SimulationTransport& transport) { transports_.push_back(&transport); }

void SimulationBus::broadcast(NodeId sender, const Message& message) {
  SimulationEvent event;
  event.type = SimulationEventType::MessageSent;
  event.now_ms = now_ms_;
  event.node_id = sender;
  event.message = message;
  events_.push_back(event);

  for (SimulationTransport* transport : transports_) {
    if (transport->nodeId() != sender) {
      transport->deliver(message);
    }
  }
}

class SimulationHealth : public HealthMonitor {
public:
  HealthStatus poll() override { return health_; }
  void set(HealthStatus health) { health_ = health; }

private:
  HealthStatus health_ = HealthStatus::Nominal;
};

bool isKnown(HealthStatus health) {
  return health == HealthStatus::Nominal || health == HealthStatus::Quiescent ||
         health == HealthStatus::Fatal;
}

void validateNodeId(NodeId node_id, std::size_t node_count) {
  if (static_cast<std::size_t>(node_id) >= node_count) {
    throw std::invalid_argument("simulation input references an unknown node");
  }
}

void validateFrame(const SimulationFrame& frame, std::size_t node_count) {
  for (const SatelliteUpdate& update : frame.satellite_updates) {
    validateNodeId(update.node_id, node_count);
    if (!isValid(update.satellite)) {
      throw std::invalid_argument("simulation frame has an invalid satellite snapshot");
    }
  }
  for (const HealthUpdate& update : frame.health_updates) {
    validateNodeId(update.node_id, node_count);
    if (!isKnown(update.health)) {
      throw std::invalid_argument("simulation frame has an invalid health state");
    }
  }
  for (const MissionCommand& command : frame.mission_commands) {
    validateNodeId(command.leader, node_count);
    if (!isValid(command.objective)) {
      throw std::invalid_argument("simulation frame has an invalid mission objective");
    }
  }
}

void validateTrace(const SimulationTrace& trace) {
  if (trace.version != kSimulationTraceVersion) {
    throw std::invalid_argument("unsupported simulation trace version");
  }
  if (trace.nodes.empty() || trace.nodes.size() > kMaximumNodes) {
    throw std::invalid_argument("simulation trace must configure between 1 and 16 nodes");
  }
  for (std::size_t index = 0; index < trace.nodes.size(); ++index) {
    const NodeConfiguration& node = trace.nodes[index];
    if (static_cast<std::size_t>(node.node_id) != index) {
      throw std::invalid_argument("simulation node IDs must be contiguous and ordered");
    }
    if (!isValid(node.satellite)) {
      throw std::invalid_argument("simulation node has an invalid satellite snapshot");
    }
  }

  uint32_t previous_time = 0U;
  bool first_frame = true;
  for (const SimulationFrame& frame : trace.frames) {
    if (!first_frame && frame.now_ms == previous_time) {
      throw std::invalid_argument("consecutive simulation frames must not repeat a time");
    }
    first_frame = false;
    previous_time = frame.now_ms;
    validateFrame(frame, trace.nodes.size());
  }
}

void recordStateChange(std::vector<SimulationEvent>& events, uint32_t now_ms, NodeId node_id,
                       ControllerState previous, ControllerState current) {
  if (previous == current) {
    return;
  }
  SimulationEvent event;
  event.type = SimulationEventType::StateChanged;
  event.now_ms = now_ms;
  event.node_id = node_id;
  event.previous_state = previous;
  event.current_state = current;
  events.push_back(event);
}

NodeObservation observe(const SwarmController& controller) {
  NodeObservation observation;
  observation.node_id = controller.nodeId();
  observation.state = controller.state();
  observation.satellite = controller.satelliteSnapshot();
  observation.mission_id = controller.currentMissionId();
  observation.assigned_node = controller.assignedNode();
  observation.candidacy_score = controller.currentCandidacyScore();
  observation.communication_failures = controller.consecutiveCommunicationFailures();
  return observation;
}

} // namespace

SimulationResult runSimulationTrace(const SimulationTrace& trace) {
  validateTrace(trace);

  SimulationResult result;
  SimulationBus bus(result.events);
  HistoricalOrbitalScorer scorer;
  ControllerConfig controller_config = trace.controller;
  controller_config.node_capacity = static_cast<uint8_t>(trace.nodes.size());

  std::vector<std::unique_ptr<SimulationTransport>> transports;
  std::vector<std::unique_ptr<SimulationHealth>> health_monitors;
  std::vector<std::unique_ptr<SwarmController>> controllers;
  transports.reserve(trace.nodes.size());
  health_monitors.reserve(trace.nodes.size());
  controllers.reserve(trace.nodes.size());

  for (const NodeConfiguration& node : trace.nodes) {
    transports.push_back(std::make_unique<SimulationTransport>(node.node_id, bus));
    health_monitors.push_back(std::make_unique<SimulationHealth>());
  }
  for (const NodeConfiguration& node : trace.nodes) {
    const auto index = static_cast<std::size_t>(node.node_id);
    controllers.push_back(
        std::make_unique<SwarmController>(node.node_id, node.satellite, *transports[index],
                                          *health_monitors[index], scorer, controller_config));
  }

  for (const SimulationFrame& frame : trace.frames) {
    bus.setTime(frame.now_ms);

    for (const HealthUpdate& update : frame.health_updates) {
      health_monitors[update.node_id]->set(update.health);
    }
    for (const SatelliteUpdate& update : frame.satellite_updates) {
      if (!controllers[update.node_id]->updateSatelliteSnapshot(update.satellite)) {
        throw std::invalid_argument("validated satellite update was rejected");
      }
    }
    for (const MissionCommand& command : frame.mission_commands) {
      SimulationEvent event;
      event.type = SimulationEventType::MissionCommand;
      event.now_ms = frame.now_ms;
      event.node_id = command.leader;
      event.objective = command.objective;
      result.events.push_back(event);
      const std::size_t event_index = result.events.size() - 1U;
      const ControllerState previous = controllers[command.leader]->state();
      result.events[event_index].accepted =
          controllers[command.leader]->initiateMission(command.objective, frame.now_ms);
      recordStateChange(result.events, frame.now_ms, command.leader, previous,
                        controllers[command.leader]->state());
    }

    for (const std::unique_ptr<SwarmController>& controller : controllers) {
      const ControllerState previous = controller->state();
      controller->update(frame.now_ms);
      recordStateChange(result.events, frame.now_ms, controller->nodeId(), previous,
                        controller->state());
    }

    FrameObservation observation;
    observation.now_ms = frame.now_ms;
    observation.nodes.reserve(controllers.size());
    for (const std::unique_ptr<SwarmController>& controller : controllers) {
      observation.nodes.push_back(observe(*controller));
    }
    result.frames.push_back(std::move(observation));
  }

  return result;
}

} // namespace satellite_swarm::simulation
