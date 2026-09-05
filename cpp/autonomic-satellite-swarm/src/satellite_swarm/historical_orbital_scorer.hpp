#ifndef SATELLITE_SWARM_HISTORICAL_ORBITAL_SCORER_HPP
#define SATELLITE_SWARM_HISTORICAL_ORBITAL_SCORER_HPP

#include "satellite_swarm/interfaces.hpp"

namespace satellite_swarm {

// Reproduces the 2019 proof-of-concept heuristic with defined behavior at edge cases. It is useful
// for historical comparison and demonstrations; it is not a flight-dynamics model.
class HistoricalOrbitalScorer : public CandidacyScorer {
public:
  uint8_t score(const SatelliteSnapshot& satellite, const Coordinate& objective) const override;
};

namespace orbital_heuristic {

float latitudeDistanceDegrees(float start_latitude, float objective_latitude,
                              TravelDirection direction, bool short_path);
float longitudeDistanceDegrees(const Coordinate& start, const Coordinate& objective,
                               TravelDirection direction, bool short_latitude_path);

} // namespace orbital_heuristic
} // namespace satellite_swarm

#endif
