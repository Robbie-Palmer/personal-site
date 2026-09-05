#include "satellite_swarm/historical_orbital_scorer.hpp"

#include <catch2/catch_test_macros.hpp>
#include <limits>

using namespace satellite_swarm;

namespace {

SatelliteSnapshot at(float longitude, float latitude) {
  SatelliteSnapshot satellite;
  satellite.coordinate = Coordinate(longitude, latitude);
  return satellite;
}

} // namespace

TEST_CASE("the historical paper examples remain characterized") {
  const HistoricalOrbitalScorer scorer;

  CHECK(scorer.score(at(0.0F, 90.0F), Coordinate(0.0F, -90.0F)) == 50);
  CHECK(scorer.score(at(0.0F, 90.0F), Coordinate(1.0F, -90.0F)) == 41);
  CHECK(scorer.score(at(0.0F, 90.0F), Coordinate(3.0F, -90.0F)) == 0);
  CHECK(scorer.score(at(0.0F, 0.0F), Coordinate(-180.0F, -45.0F)) == 62);
}

TEST_CASE("the historical heuristic has defined edge-case behavior") {
  const HistoricalOrbitalScorer scorer;
  CHECK(scorer.score(at(12.0F, 20.0F), Coordinate(12.0F, 20.0F)) == 100);
  CHECK(scorer.score(at(12.0F, 20.0F), Coordinate(13.0F, 20.0F)) < 100);
  CHECK(scorer.score(at(0.0F, 91.0F), Coordinate(0.0F, 0.0F)) == 0);

  SatelliteSnapshot invalid = at(0.0F, 0.0F);
  invalid.available_propulsion_energy_joules = 0.0F;
  CHECK(scorer.score(invalid, Coordinate(0.0F, -10.0F)) == 0);

  invalid = at(0.0F, 0.0F);
  invalid.orbital_radius_metres = std::numeric_limits<float>::infinity();
  CHECK(scorer.score(invalid, Coordinate(0.0F, -10.0F)) == 0);

  invalid = at(0.0F, 0.0F);
  invalid.mass_kilograms = std::numeric_limits<float>::quiet_NaN();
  CHECK(scorer.score(invalid, Coordinate(0.0F, -10.0F)) == 0);

  invalid = at(0.0F, 0.0F);
  invalid.orbital_radius_metres = std::numeric_limits<float>::min();
  CHECK(scorer.score(invalid, Coordinate(0.0F, -10.0F)) == 0);
}

TEST_CASE("directed latitude distance accounts for pole crossings") {
  using orbital_heuristic::latitudeDistanceDegrees;

  CHECK(latitudeDistanceDegrees(90.0F, -90.0F, TravelDirection::Southbound, true) == 180.0F);
  CHECK(latitudeDistanceDegrees(0.0F, -45.0F, TravelDirection::Southbound, true) == 45.0F);
  CHECK(latitudeDistanceDegrees(-45.0F, 0.0F, TravelDirection::Southbound, true) == 135.0F);
}
