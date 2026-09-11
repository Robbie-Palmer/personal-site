#include "satellite_swarm/browser_simulation.hpp"
#include "satellite_swarm/simulation.hpp"

#include <catch2/catch_test_macros.hpp>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

using namespace satellite_swarm;
using namespace satellite_swarm::simulation;

namespace {

SatelliteSnapshot satelliteAt(float longitude, float latitude) {
  SatelliteSnapshot satellite;
  satellite.coordinate = Coordinate(longitude, latitude);
  return satellite;
}

SimulationTrace demonstrationTrace() {
  SimulationTrace trace;
  trace.controller.response_window_ms = 100U;
  trace.nodes = {
      {0U, satelliteAt(3.0F, 90.0F)},
      {1U, satelliteAt(0.0F, 90.0F)},
      {2U, satelliteAt(1.0F, 90.0F)},
  };
  for (uint32_t now_ms = 0U; now_ms <= 100U; now_ms += 10U) {
    SimulationFrame frame;
    frame.now_ms = now_ms;
    if (now_ms == 0U) {
      frame.mission_commands.push_back({0U, Coordinate(0.0F, -90.0F)});
    }
    trace.frames.push_back(frame);
  }
  return trace;
}

} // namespace

TEST_CASE("a versioned trace reproduces the three-node mission in an ordered event log") {
  const SimulationResult result = runSimulationTrace(demonstrationTrace());

  REQUIRE(result.frames.size() == 11U);
  const FrameObservation& final_frame = result.frames.back();
  REQUIRE(final_frame.nodes.size() == 3U);
  CHECK(final_frame.nodes[0].assigned_node == 1U);
  CHECK(final_frame.nodes[0].state == ControllerState::Idle);
  CHECK(final_frame.nodes[1].state == ControllerState::Active);
  CHECK(final_frame.nodes[2].state == ControllerState::Idle);

  std::vector<MessageType> sent_messages;
  for (const SimulationEvent& event : result.events) {
    if (event.type == SimulationEventType::MessageSent) {
      sent_messages.push_back(event.message.type);
    }
  }
  REQUIRE(sent_messages.size() == 6U);
  CHECK(sent_messages[0] == MessageType::MissionRequest);
  CHECK(sent_messages[1] == MessageType::Candidacy);
  CHECK(sent_messages[2] == MessageType::Candidacy);
  CHECK(sent_messages[3] == MessageType::Acknowledgement);
  CHECK(sent_messages[4] == MessageType::Acknowledgement);
  CHECK(sent_messages[5] == MessageType::MissionAssignment);
}

TEST_CASE("a frame snapshot feeds both candidacy scoring and node observation") {
  SimulationTrace trace = demonstrationTrace();
  trace.nodes[1].satellite = satelliteAt(3.0F, 90.0F);
  trace.frames[0].satellite_updates.push_back({1U, satelliteAt(0.0F, 90.0F)});

  const SimulationResult result = runSimulationTrace(trace);

  REQUIRE(result.frames.front().nodes.size() == 3U);
  CHECK(result.frames.front().nodes[1].satellite.coordinate.longitude_degrees == 0.0F);

  bool found_score = false;
  for (const SimulationEvent& event : result.events) {
    if (event.type == SimulationEventType::MessageSent &&
        event.message.type == MessageType::Candidacy && event.node_id == 1U) {
      CHECK(event.message.score == 50U);
      found_score = true;
    }
  }
  CHECK(found_score);
}

TEST_CASE("malformed simulation traces fail before a controller runs") {
  SECTION("unsupported version") {
    SimulationTrace trace = demonstrationTrace();
    trace.version = 2U;
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("repeated frame time") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[1].now_ms = trace.frames[0].now_ms;
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("backward frame time") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[2].now_ms = 5U;
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("unknown node") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[0].health_updates.push_back({9U, HealthStatus::Fatal});
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("no configured nodes") {
    SimulationTrace trace = demonstrationTrace();
    trace.nodes.clear();
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("too many configured nodes") {
    SimulationTrace trace = demonstrationTrace();
    trace.nodes.resize(kMaximumNodes + 1U);
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("noncontiguous node IDs") {
    SimulationTrace trace = demonstrationTrace();
    trace.nodes[1].node_id = 2U;
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("invalid initial satellite") {
    SimulationTrace trace = demonstrationTrace();
    trace.nodes[1].satellite.mass_kilograms = 0.0F;
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("invalid satellite update") {
    SimulationTrace trace = demonstrationTrace();
    SatelliteSnapshot invalid = satelliteAt(0.0F, 0.0F);
    invalid.coordinate.latitude_degrees = 91.0F;
    trace.frames[0].satellite_updates.push_back({1U, invalid});
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("invalid health state") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[0].health_updates.push_back({1U, static_cast<HealthStatus>(3U)});
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("unknown mission leader") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[0].mission_commands.push_back({9U, Coordinate()});
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }

  SECTION("invalid mission objective") {
    SimulationTrace trace = demonstrationTrace();
    trace.frames[0].mission_commands.push_back({1U, Coordinate(181.0F, 0.0F)});
    CHECK_THROWS_AS(runSimulationTrace(trace), std::invalid_argument);
  }
}

TEST_CASE("trace frames record health changes and rejected mission commands") {
  SimulationTrace trace = demonstrationTrace();
  trace.frames[0].health_updates.push_back({2U, HealthStatus::Quiescent});
  trace.frames[0].mission_commands.push_back({0U, Coordinate(10.0F, 20.0F)});
  trace.frames[1].health_updates.push_back({2U, HealthStatus::Fatal});

  const SimulationResult result = runSimulationTrace(trace);

  CHECK(result.frames[0].nodes[2].state == ControllerState::Quiescent);
  CHECK(result.frames[1].nodes[2].state == ControllerState::SafeDisabled);

  std::size_t accepted_commands = 0U;
  std::size_t rejected_commands = 0U;
  for (const SimulationEvent& event : result.events) {
    if (event.type == SimulationEventType::MissionCommand) {
      event.accepted ? ++accepted_commands : ++rejected_commands;
    }
  }
  CHECK(accepted_commands == 1U);
  CHECK(rejected_commands == 1U);
}

TEST_CASE("trace time supports one unsigned clock rollover") {
  SimulationTrace trace = demonstrationTrace();
  trace.frames.clear();
  SimulationFrame before_rollover;
  before_rollover.now_ms = std::numeric_limits<uint32_t>::max();
  trace.frames.push_back(before_rollover);
  SimulationFrame after_rollover;
  after_rollover.now_ms = 0U;
  trace.frames.push_back(after_rollover);

  const SimulationResult result = runSimulationTrace(trace);
  REQUIRE(result.frames.size() == 2U);
  CHECK(result.frames[0].now_ms == std::numeric_limits<uint32_t>::max());
  CHECK(result.frames[1].now_ms == 0U);
}

TEST_CASE("the browser demonstration accepts a caller-provided objective") {
  const Coordinate objective(18.25F, -34.5F);
  const SimulationTrace trace = makeBrowserDemonstrationTrace(objective);

  REQUIRE_FALSE(trace.frames.empty());
  REQUIRE(trace.frames.front().mission_commands.size() == 1U);
  CHECK(trace.frames.front().mission_commands.front().objective.longitude_degrees == 18.25F);
  CHECK(trace.frames.front().mission_commands.front().objective.latitude_degrees == -34.5F);

  const std::string json = serializeBrowserSimulation(trace, runSimulationTrace(trace));
  CHECK(json.find(R"("scenario": "three-node-objective-pass")") != std::string::npos);
  CHECK(json.find(R"("longitudeDegrees":18.25,"latitudeDegrees":-34.5)") != std::string::npos);
}

TEST_CASE("browser serialization rejects incomplete traces and results") {
  SimulationTrace trace = makeBrowserDemonstrationTrace(Coordinate(0.0F, -90.0F));
  const SimulationResult complete_result = runSimulationTrace(trace);

  SECTION("missing command") {
    trace.frames.front().mission_commands.clear();
    CHECK_THROWS_AS(serializeBrowserSimulation(trace, complete_result), std::invalid_argument);
  }

  SECTION("missing sampled frame") {
    SimulationResult incomplete_result = complete_result;
    incomplete_result.frames.resize(12U);
    CHECK_THROWS_AS(serializeBrowserSimulation(trace, incomplete_result), std::invalid_argument);
  }
}

TEST_CASE("the browser demonstration rejects an invalid objective") {
  CHECK_THROWS_AS(makeBrowserDemonstrationTrace(Coordinate(0.0F, 91.0F)), std::invalid_argument);
}
