#include "satellite_swarm/browser_api.hpp"

#include "satellite_swarm/browser_simulation.hpp"

#include <exception>
#include <stdexcept>
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define SATELLITE_SWARM_KEEPALIVE EMSCRIPTEN_KEEPALIVE
#else
#define SATELLITE_SWARM_KEEPALIVE
#endif

#ifndef SATELLITE_SWARM_SOURCE_REVISION
#define SATELLITE_SWARM_SOURCE_REVISION "unknown"
#endif

namespace {

constexpr uint32_t kBrowserApiVersion = 4U;

satellite_swarm::simulation::BrowserScenario parseScenario(uint32_t scenario) {
  if (scenario == static_cast<uint32_t>(satellite_swarm::simulation::BrowserScenario::Nominal)) {
    return satellite_swarm::simulation::BrowserScenario::Nominal;
  }
  if (scenario ==
      static_cast<uint32_t>(satellite_swarm::simulation::BrowserScenario::LostAssignment)) {
    return satellite_swarm::simulation::BrowserScenario::LostAssignment;
  }
  throw std::invalid_argument("unknown browser simulation scenario");
}

struct BrowserState {
  std::string result;
  std::string error;
};

BrowserState& browserState() {
  static BrowserState state;
  return state;
}

} // namespace

extern "C" SATELLITE_SWARM_KEEPALIVE uint32_t satellite_swarm_browser_api_version() noexcept {
  return kBrowserApiVersion;
}

extern "C" SATELLITE_SWARM_KEEPALIVE const char* satellite_swarm_source_revision() noexcept {
  return SATELLITE_SWARM_SOURCE_REVISION;
}

extern "C" SATELLITE_SWARM_KEEPALIVE const char*
satellite_swarm_run_demonstration(float longitude_degrees, float latitude_degrees,
                                  uint32_t scenario) noexcept {
  auto& state = browserState();
  try {
    state.result = satellite_swarm::simulation::runBrowserDemonstration(
        satellite_swarm::Coordinate(longitude_degrees, latitude_degrees), parseScenario(scenario));
    state.error.clear();
    return state.result.c_str();
  } catch (const std::exception& error) {
    state.result.clear();
    state.error = error.what();
    return nullptr;
  } catch (...) {
    state.result.clear();
    state.error = "unknown simulation error";
    return nullptr;
  }
}

extern "C" SATELLITE_SWARM_KEEPALIVE const char* satellite_swarm_last_error() noexcept {
  return browserState().error.c_str();
}
