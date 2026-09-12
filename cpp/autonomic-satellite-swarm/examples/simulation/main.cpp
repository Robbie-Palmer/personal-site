#include "satellite_swarm/browser_simulation.hpp"

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

int runSimulation(bool json) {
  const Coordinate kSouthPole(0.0F, -90.0F);
  const BrowserSimulation simulation = makeBrowserDemonstration(kSouthPole);
  const SimulationResult result = runSimulationTrace(simulation.trace);
  if (json) {
    std::cout << serializeBrowserSimulation(simulation, result);
    return 0;
  }

  const FrameObservation& final_frame = result.frames.back();
  const NodeObservation& leader = final_frame.nodes.front();
  std::cout << "Mission " << leader.mission_id << " assigned to node "
            << static_cast<unsigned int>(leader.assigned_node) << '\n';
  for (const NodeObservation& node : final_frame.nodes) {
    std::cout << "node " << static_cast<unsigned int>(node.node_id) << ": " << stateName(node.state)
              << '\n';
  }

  return final_frame.nodes[1].state == ControllerState::Active ? 0 : 1;
}

} // namespace

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
