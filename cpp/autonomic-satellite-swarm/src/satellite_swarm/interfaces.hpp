#ifndef SATELLITE_SWARM_INTERFACES_HPP
#define SATELLITE_SWARM_INTERFACES_HPP

#include "satellite_swarm/types.hpp"

namespace satellite_swarm {

class Transport {
public:
  virtual ~Transport() = default;

  virtual bool send(const Message& message) = 0;
  virtual bool receive(Message& message) = 0;
};

class HealthMonitor {
public:
  virtual ~HealthMonitor() = default;

  virtual HealthStatus poll() = 0;
};

class CandidacyScorer {
public:
  virtual ~CandidacyScorer() = default;

  // The controller constrains implementations' results to the protocol's 0..100 score range.
  virtual uint8_t score(const SatelliteSnapshot& satellite, const Coordinate& objective) const = 0;
};

} // namespace satellite_swarm

#endif
