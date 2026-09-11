#ifndef SATELLITE_SWARM_BROWSER_API_HPP
#define SATELLITE_SWARM_BROWSER_API_HPP

#include <stdint.h>

extern "C" {

uint32_t satellite_swarm_browser_api_version() noexcept;

const char* satellite_swarm_run_demonstration(float longitude_degrees,
                                              float latitude_degrees) noexcept;

const char* satellite_swarm_last_error() noexcept;
}

#endif
