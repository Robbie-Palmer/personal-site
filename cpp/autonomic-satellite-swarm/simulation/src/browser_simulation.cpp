#include "satellite_swarm/browser_simulation.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <sstream>
#include <stdexcept>

namespace satellite_swarm::simulation {
namespace {

const char* stateName(ControllerState state) {
  switch (state) {
  case ControllerState::Idle:
    return "idle";
  case ControllerState::Leading:
    return "leading";
  case ControllerState::AwaitingAcknowledgement:
    return "awaiting acknowledgement";
  case ControllerState::AwaitingAssignment:
    return "awaiting assignment";
  case ControllerState::Active:
    return "active";
  case ControllerState::Quiescent:
    return "quiescent";
  case ControllerState::SafeDisabled:
    return "safe-disabled";
  }
  return "unknown";
}

const char* eventName(SimulationEventType type) {
  switch (type) {
  case SimulationEventType::MissionCommand:
    return "mission-command";
  case SimulationEventType::MessageSent:
    return "message-sent";
  case SimulationEventType::StateChanged:
    return "state-changed";
  }
  return "unknown";
}

const char* messageName(MessageType type) {
  switch (type) {
  case MessageType::MissionRequest:
    return "mission-request";
  case MessageType::Candidacy:
    return "candidacy";
  case MessageType::Acknowledgement:
    return "acknowledgement";
  case MessageType::MissionAssignment:
    return "mission-assignment";
  }
  return "unknown";
}

SatelliteSnapshot satelliteAt(float longitude, float latitude) {
  SatelliteSnapshot satellite;
  satellite.coordinate = Coordinate(longitude, latitude);
  return satellite;
}

void writeCoordinate(std::ostream& output, const Coordinate& coordinate) {
  output << R"({"longitudeDegrees":)" << coordinate.longitude_degrees << R"(,"latitudeDegrees":)"
         << coordinate.latitude_degrees << '}';
}

void writeBrowserNode(std::ostream& output, const NodeObservation& node) {
  output << R"({"id":)" << static_cast<unsigned int>(node.node_id) << R"(,"state":")"
         << stateName(node.state) << R"(","position":)";
  writeCoordinate(output, node.satellite.coordinate);
  output << R"(,"orbitalRadiusMetres":)" << node.satellite.orbital_radius_metres
         << R"(,"candidacyScore":)" << static_cast<unsigned int>(node.candidacy_score)
         << R"(,"missionId":)" << node.mission_id << R"(,"assignedNode":)";
  if (node.assigned_node == kBroadcastNode) {
    output << "null";
  } else {
    output << static_cast<unsigned int>(node.assigned_node);
  }
  output << '}';
}

void writeBrowserFrame(std::ostream& output, const FrameObservation& frame) {
  output << R"(    {"timeMs":)" << frame.now_ms << R"(,"nodes":[)";
  for (std::size_t node_index = 0; node_index < frame.nodes.size(); ++node_index) {
    writeBrowserNode(output, frame.nodes[node_index]);
    if (node_index + 1U != frame.nodes.size()) {
      output << ',';
    }
  }
  output << "]}";
}

void writeBrowserEvent(std::ostream& output, const SimulationEvent& event) {
  output << R"(    {"type":")" << eventName(event.type) << R"(","timeMs":)" << event.now_ms
         << R"(,"nodeId":)" << static_cast<unsigned int>(event.node_id);
  if (event.type == SimulationEventType::MissionCommand) {
    output << R"(,"accepted":)" << (event.accepted ? "true" : "false") << R"(,"objective":)";
    writeCoordinate(output, event.objective);
  } else if (event.type == SimulationEventType::MessageSent) {
    output << R"(,"message":{"type":")" << messageName(event.message.type) << R"(","origin":)"
           << static_cast<unsigned int>(event.message.origin) << R"(,"target":)";
    if (event.message.target == kBroadcastNode) {
      output << "null";
    } else {
      output << static_cast<unsigned int>(event.message.target);
    }
    output << R"(,"missionId":)" << event.message.mission_id << R"(,"score":)"
           << static_cast<unsigned int>(event.message.score) << '}';
  } else {
    output << R"(,"previousState":")" << stateName(event.previous_state) << R"(","currentState":")"
           << stateName(event.current_state) << '"';
  }
  output << '}';
}

} // namespace

SimulationTrace makeBrowserDemonstrationTrace(Coordinate objective) {
  if (!isValid(objective)) {
    throw std::invalid_argument("mission objective is outside the coordinate bounds");
  }

  SimulationTrace trace;
  trace.controller.response_window_ms = 100U;
  trace.nodes = {
      {0U, satelliteAt(-0.5F, 60.0F)},
      {1U, satelliteAt(0.0F, 10.0F)},
      {2U, satelliteAt(0.5F, 0.0F)},
  };

  for (uint32_t now_ms = 0U; now_ms <= 120U; now_ms += 10U) {
    SimulationFrame frame;
    frame.now_ms = now_ms;
    const auto step_index = now_ms / 10U;
    const auto step = static_cast<float>(step_index);
    frame.satellite_updates = {
        {0U, satelliteAt(-0.5F + step * 0.06F, 60.0F - step * 0.25F)},
        {1U, satelliteAt(0.0F + step * 0.08F, 10.0F - step * 0.4F)},
        {2U, satelliteAt(0.5F + step * 0.1F, 0.0F - step * 0.3F)},
    };
    if (now_ms == 0U) {
      frame.mission_commands.push_back({0U, objective});
    }
    trace.frames.push_back(frame);
  }
  return trace;
}

std::string serializeBrowserSimulation(const SimulationTrace& trace,
                                       const SimulationResult& result) {
  if (trace.frames.empty() || trace.frames.front().mission_commands.empty()) {
    throw std::invalid_argument("browser simulation requires a mission command");
  }
  constexpr std::array<std::size_t, 4> kBrowserFrameIndices = {0U, 1U, 10U, 12U};
  for (const std::size_t frame_index : kBrowserFrameIndices) {
    if (frame_index >= result.frames.size()) {
      throw std::invalid_argument("browser simulation does not contain the required frames");
    }
  }

  const Coordinate objective = trace.frames.front().mission_commands.front().objective;
  std::ostringstream output;
  output << R"({
  "schemaVersion": )"
         << static_cast<unsigned int>(kBrowserSimulationSchemaVersion) << R"(,
  "traceVersion": )"
         << static_cast<unsigned int>(trace.version) << R"(,
  "scenario": "three-node-objective-pass",
  "source": "portable C++ SimulationTrace",
  "positionModel": "scripted simulation data; not orbit propagation",
  "objective": )";
  writeCoordinate(output, objective);
  output << R"(,
  "frames": [
)";

  for (std::size_t output_index = 0; output_index < kBrowserFrameIndices.size(); ++output_index) {
    writeBrowserFrame(output, result.frames[kBrowserFrameIndices[output_index]]);
    if (output_index + 1U != kBrowserFrameIndices.size()) {
      output << ',';
    }
    output << '\n';
  }

  output << R"(  ],
  "events": [
)";
  for (std::size_t event_index = 0; event_index < result.events.size(); ++event_index) {
    writeBrowserEvent(output, result.events[event_index]);
    if (event_index + 1U != result.events.size()) {
      output << ',';
    }
    output << '\n';
  }
  output << "  ]\n}\n";
  return output.str();
}

std::string runBrowserDemonstration(Coordinate objective) {
  const SimulationTrace trace = makeBrowserDemonstrationTrace(objective);
  return serializeBrowserSimulation(trace, runSimulationTrace(trace));
}

} // namespace satellite_swarm::simulation
