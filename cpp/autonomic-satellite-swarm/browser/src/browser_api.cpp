#include "satellite_swarm/browser_api.hpp"

#include "satellite_swarm/browser_simulation.hpp"

#include <exception>
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define SATELLITE_SWARM_KEEPALIVE EMSCRIPTEN_KEEPALIVE
#else
#define SATELLITE_SWARM_KEEPALIVE
#endif

namespace {

constexpr uint32_t kBrowserApiVersion = 1U;

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

extern "C" SATELLITE_SWARM_KEEPALIVE const char*
satellite_swarm_run_demonstration(float longitude_degrees, float latitude_degrees) noexcept {
  auto& state = browserState();
  try {
    state.result = satellite_swarm::simulation::runBrowserDemonstration(
        satellite_swarm::Coordinate(longitude_degrees, latitude_degrees));
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
