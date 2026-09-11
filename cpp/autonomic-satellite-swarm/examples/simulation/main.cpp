#include "satellite_swarm/simulation.hpp"

#include <array>
#include <cstdint>
#include <exception>
#include <iostream>
#include <string_view>

namespace {

using namespace satellite_swarm;
using namespace satellite_swarm::simulation;

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

SimulationTrace demonstrationTrace() {
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
      frame.mission_commands.push_back({0U, Coordinate(0.0F, -55.0F)});
    }
    trace.frames.push_back(frame);
  }
  return trace;
}

void writeCoordinate(const Coordinate& coordinate) {
  std::cout << R"({"longitudeDegrees":)" << coordinate.longitude_degrees << R"(,"latitudeDegrees":)"
            << coordinate.latitude_degrees << '}';
}

// The fixture drift check validates this output byte for byte. Exclude the
// allocator and exception branches attributed to these stream expressions.
// GCOVR_EXCL_BR_START
void writeBrowserNode(const NodeObservation& node) {
  std::cout << R"({"id":)" << static_cast<unsigned int>(node.node_id) << R"(,"state":")"
            << stateName(node.state) << R"(","position":)";
  writeCoordinate(node.satellite.coordinate);
  std::cout << R"(,"orbitalRadiusMetres":)" << node.satellite.orbital_radius_metres
            << R"(,"candidacyScore":)" << static_cast<unsigned int>(node.candidacy_score)
            << R"(,"missionId":)" << node.mission_id << R"(,"assignedNode":)";
  if (node.assigned_node == kBroadcastNode) {
    std::cout << "null";
  } else {
    std::cout << static_cast<unsigned int>(node.assigned_node);
  }
  std::cout << '}';
}

void writeBrowserFrame(const FrameObservation& frame) {
  std::cout << R"(    {"timeMs":)" << frame.now_ms << R"(,"nodes":[)";
  for (std::size_t node_index = 0; node_index < frame.nodes.size(); ++node_index) {
    writeBrowserNode(frame.nodes[node_index]);
    if (node_index + 1U != frame.nodes.size()) {
      std::cout << ',';
    }
  }
  std::cout << "]}";
}

void writeBrowserEvent(const SimulationEvent& event) {
  std::cout << R"(    {"type":")" << eventName(event.type) << R"(","timeMs":)" << event.now_ms
            << R"(,"nodeId":)" << static_cast<unsigned int>(event.node_id);
  if (event.type == SimulationEventType::MissionCommand) {
    std::cout << R"(,"accepted":)" << (event.accepted ? "true" : "false") << R"(,"objective":)";
    writeCoordinate(event.objective);
  } else if (event.type == SimulationEventType::MessageSent) {
    std::cout << R"(,"message":{"type":")" << messageName(event.message.type) << R"(","origin":)"
              << static_cast<unsigned int>(event.message.origin) << R"(,"target":)";
    if (event.message.target == kBroadcastNode) {
      std::cout << "null";
    } else {
      std::cout << static_cast<unsigned int>(event.message.target);
    }
    std::cout << R"(,"missionId":)" << event.message.mission_id << R"(,"score":)"
              << static_cast<unsigned int>(event.message.score) << '}';
  } else {
    std::cout << R"(,"previousState":")" << stateName(event.previous_state)
              << R"(","currentState":")" << stateName(event.current_state) << '"';
  }
  std::cout << '}';
}

void writeBrowserSimulation(const SimulationTrace& trace, const SimulationResult& result) {
  const auto objective = trace.frames.front().mission_commands.front().objective;
  std::cout << R"({
  "schemaVersion": 1,
  "traceVersion": )"
            << static_cast<unsigned int>(trace.version) << R"(,
  "scenario": "three-node-scripted-pass",
  "source": "native C++ SimulationTrace",
  "positionModel": "scripted simulation data; not orbit propagation",
  "objective": )";
  writeCoordinate(objective);
  std::cout << R"(,
  "frames": [
)";

  constexpr std::array<std::size_t, 4> kBrowserFrameIndices = {0U, 1U, 10U, 12U};
  for (std::size_t output_index = 0; output_index < kBrowserFrameIndices.size(); ++output_index) {
    writeBrowserFrame(result.frames.at(kBrowserFrameIndices[output_index]));
    if (output_index + 1U != kBrowserFrameIndices.size()) {
      std::cout << ',';
    }
    std::cout << '\n';
  }

  std::cout << R"(  ],
  "events": [
)";
  for (std::size_t event_index = 0; event_index < result.events.size(); ++event_index) {
    writeBrowserEvent(result.events[event_index]);
    if (event_index + 1U != result.events.size()) {
      std::cout << ',';
    }
    std::cout << '\n';
  }
  std::cout << "  ]\n}\n";
}
// GCOVR_EXCL_BR_STOP

} // namespace

int runSimulation(bool json) {
  const SimulationTrace trace = demonstrationTrace();
  const SimulationResult result = runSimulationTrace(trace);
  if (json) {
    writeBrowserSimulation(trace, result);
    return 0;
  }
  const FrameObservation& final_frame = result.frames.back();
  const NodeObservation& leader = final_frame.nodes.front();

  std::cout << "Mission " << leader.mission_id << " assigned to node "
            << static_cast<unsigned int>(leader.assigned_node) << "\n";
  for (const NodeObservation& node : final_frame.nodes) {
    std::cout << "node " << static_cast<unsigned int>(node.node_id) << ": " << stateName(node.state)
              << '\n';
  }

  return final_frame.nodes[1].state == ControllerState::Active ? 0 : 1;
}

int main(int argc, char* argv[]) {
  try {
    const bool json = argc == 2 && std::string_view(argv[1]) == "--json";
    if (argc > 2 || (argc == 2 && !json)) {
      std::cerr << "usage: autonomic-satellite-swarm-simulation [--json]\n";
      return 2;
    }
    return runSimulation(json);
  } catch (const std::exception& error) {
    std::cerr << "simulation setup failed: " << error.what() << '\n';
    return 1;
  }
}
