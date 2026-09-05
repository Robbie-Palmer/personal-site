#include "satellite_swarm/historical_orbital_scorer.hpp"

#include <math.h>

namespace satellite_swarm {
namespace {

constexpr float kPi = 3.14159265358979323846F;
constexpr float kEarthGravitationalParameter = 398589590000000.0F;
constexpr float kDistanceScale = 1000000.0F;

bool hasPassedLatitude(float current, float objective, TravelDirection direction) {
  if (direction == TravelDirection::Southbound) {
    return current <= objective;
  }
  return objective <= current;
}

float flippedLongitude(float longitude) {
  return longitude < 0.0F ? longitude + 180.0F : longitude - 180.0F;
}

float shortestLongitudeDifference(float current, float objective) {
  float difference = fabsf(current - objective);
  if (difference > 180.0F) {
    difference = 360.0F - difference;
  }
  return difference;
}

float metresFromDegrees(float radius, float degrees) {
  return (2.0F * kPi * radius * degrees) / 360.0F;
}

uint8_t pathScore(const SatelliteSnapshot& satellite, const Coordinate& objective,
                  bool short_latitude_path) {
  const float longitude_degrees = orbital_heuristic::longitudeDistanceDegrees(
      satellite.coordinate, objective, satellite.travel_direction, short_latitude_path);
  const float latitude_degrees = orbital_heuristic::latitudeDistanceDegrees(
      satellite.coordinate.latitude_degrees, objective.latitude_degrees, satellite.travel_direction,
      short_latitude_path);
  const float longitude_distance =
      metresFromDegrees(satellite.orbital_radius_metres, longitude_degrees);
  const float latitude_distance =
      metresFromDegrees(satellite.orbital_radius_metres, latitude_degrees);

  if (latitude_distance == 0.0F) {
    return longitude_distance == 0.0F ? 100U : 0U;
  }

  const float velocity_squared = kEarthGravitationalParameter / satellite.orbital_radius_metres;
  const float scaled_longitude = longitude_distance / kDistanceScale;
  const float scaled_latitude = latitude_distance / kDistanceScale;
  const float energy_required =
      (4.0F * satellite.mass_kilograms * scaled_longitude * scaled_longitude * velocity_squared) /
      (scaled_latitude * scaled_latitude);
  const float raw_energy_fraction = energy_required / satellite.available_propulsion_energy_joules;
  const float energy_fraction = raw_energy_fraction < 1.0F ? raw_energy_fraction : 1.0F;
  const int energy_score = static_cast<int>(lroundf(100.0F * (1.0F - energy_fraction)));

  const float orbit_fraction = latitude_degrees / 360.0F;
  const int time_score = static_cast<int>(100.0F * (1.0F - orbit_fraction));
  const int combined = (energy_score * time_score) / 100;
  const int bounded = combined < 0 ? 0 : (combined > 100 ? 100 : combined);
  return static_cast<uint8_t>(bounded);
}

} // namespace

uint8_t HistoricalOrbitalScorer::score(const SatelliteSnapshot& satellite,
                                       const Coordinate& objective) const {
  if (!isValid(satellite.coordinate) || !isValid(objective) ||
      !isfinite(satellite.orbital_radius_metres) || !isfinite(satellite.mass_kilograms) ||
      !isfinite(satellite.available_propulsion_energy_joules) ||
      satellite.orbital_radius_metres <= 0.0F || satellite.mass_kilograms <= 0.0F ||
      satellite.available_propulsion_energy_joules <= 0.0F) {
    return 0U;
  }
  if (satellite.coordinate.longitude_degrees == objective.longitude_degrees &&
      satellite.coordinate.latitude_degrees == objective.latitude_degrees) {
    return 100U;
  }

  const uint8_t short_path_score = pathScore(satellite, objective, true);
  const uint8_t long_path_score = pathScore(satellite, objective, false);
  return short_path_score > long_path_score ? short_path_score : long_path_score;
}

namespace orbital_heuristic {

float longitudeDistanceDegrees(const Coordinate& start, const Coordinate& objective,
                               TravelDirection direction, bool short_latitude_path) {
  float start_longitude = start.longitude_degrees;
  const bool passed =
      hasPassedLatitude(start.latitude_degrees, objective.latitude_degrees, direction);
  if (short_latitude_path == passed) {
    start_longitude = flippedLongitude(start_longitude);
  }
  return shortestLongitudeDifference(start_longitude, objective.longitude_degrees);
}

float latitudeDistanceDegrees(float start_latitude, float objective_latitude,
                              TravelDirection direction, bool short_path) {
  const float start_adjusted = start_latitude + 90.0F;
  const float objective_adjusted = objective_latitude + 90.0F;

  if (direction == TravelDirection::Southbound) {
    if (start_adjusted > objective_adjusted) {
      return short_path ? start_adjusted - objective_adjusted : start_adjusted + objective_adjusted;
    }
    return short_path ? start_adjusted + objective_adjusted
                      : 360.0F + start_adjusted - objective_adjusted;
  }

  if (objective_adjusted > start_adjusted) {
    return short_path ? objective_adjusted - start_adjusted
                      : 360.0F - start_adjusted - objective_adjusted;
  }
  return short_path ? 360.0F - start_adjusted - objective_adjusted
                    : 360.0F - start_adjusted + objective_adjusted;
}

} // namespace orbital_heuristic
} // namespace satellite_swarm
