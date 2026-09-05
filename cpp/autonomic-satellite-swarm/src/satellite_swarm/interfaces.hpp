#ifndef SATELLITE_SWARM_INTERFACES_HPP
#define SATELLITE_SWARM_INTERFACES_HPP

#include "satellite_swarm/types.hpp"

namespace satellite_swarm {

class Transport {
public:
  virtual ~Transport() {}

  virtual bool send(const Message& message) = 0;
  virtual bool receive(Message& message) = 0;
};

class HealthMonitor {
public:
  virtual ~HealthMonitor() {}

  virtual HealthStatus poll() = 0;
};

class CandidacyScorer {
public:
  virtual ~CandidacyScorer() {}

  virtual uint8_t score(const SatelliteSnapshot& satellite, const Coordinate& objective) const = 0;
};

} // namespace satellite_swarm

#endif
