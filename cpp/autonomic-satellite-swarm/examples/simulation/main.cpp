#include "satellite_swarm/simulation.hpp"

#include <cstdint>
#include <exception>
#include <iostream>

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

SatelliteSnapshot satelliteAt(float longitude, float latitude) {
  SatelliteSnapshot satellite;
  satellite.coordinate = Coordinate(longitude, latitude);
  return satellite;
}

SimulationTrace demonstrationTrace() {
  SimulationTrace trace;
  trace.controller.response_window_ms = 100U;
  trace.nodes = {
      {0U, satelliteAt(3.0F, 90.0F)},
      {1U, satelliteAt(0.0F, 90.0F)},
      {2U, satelliteAt(1.0F, 90.0F)},
  };

  for (uint32_t now_ms = 0U; now_ms <= 120U; now_ms += 10U) {
    SimulationFrame frame;
    frame.now_ms = now_ms;
    if (now_ms == 0U) {
      frame.mission_commands.push_back({0U, Coordinate(0.0F, -90.0F)});
    }
    trace.frames.push_back(frame);
  }
  return trace;
}

} // namespace

int runSimulation() {
  const SimulationResult result = runSimulationTrace(demonstrationTrace());
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

int main() {
  try {
    return runSimulation();
  } catch (const std::exception& error) {
    std::cerr << "simulation setup failed: " << error.what() << '\n';
    return 1;
  }
}
