#ifndef SATELLITE_SWARM_BROWSER_SIMULATION_HPP
#define SATELLITE_SWARM_BROWSER_SIMULATION_HPP

#include "satellite_swarm/simulation.hpp"

#include <string>

namespace satellite_swarm::simulation {

constexpr uint8_t kBrowserSimulationSchemaVersion = 1U;

SimulationTrace makeBrowserDemonstrationTrace(Coordinate objective);

std::string serializeBrowserSimulation(const SimulationTrace& trace,
                                       const SimulationResult& result);

std::string runBrowserDemonstration(Coordinate objective);

} // namespace satellite_swarm::simulation

#endif
