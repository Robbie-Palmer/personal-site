#ifndef SATELLITE_SWARM_BROWSER_SIMULATION_HPP
#define SATELLITE_SWARM_BROWSER_SIMULATION_HPP

#include "satellite_swarm/simulation.hpp"

#include <string>

namespace satellite_swarm::simulation {

constexpr uint8_t kBrowserSimulationSchemaVersion = 2U;

enum class BrowserScenario : uint8_t { Nominal = 0U, LostAssignment = 1U };

SimulationTrace makeBrowserDemonstrationTrace(Coordinate objective,
                                              BrowserScenario scenario = BrowserScenario::Nominal);

std::string serializeBrowserSimulation(const SimulationTrace& trace, const SimulationResult& result,
                                       BrowserScenario scenario = BrowserScenario::Nominal);

std::string runBrowserDemonstration(Coordinate objective,
                                    BrowserScenario scenario = BrowserScenario::Nominal);

} // namespace satellite_swarm::simulation

#endif
