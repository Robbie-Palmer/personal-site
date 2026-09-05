#include "satellite_swarm/controller.hpp"
#include "test_doubles.hpp"

#include <catch2/catch_test_macros.hpp>
#include <limits>

using namespace satellite_swarm;
using namespace satellite_swarm::test;

namespace {

ControllerConfig fastConfig() {
  ControllerConfig config;
  config.response_window_ms = 100U;
  config.retry_interval_ms = 10U;
  config.maximum_attempts = 2U;
  config.failed_missions_before_safe_disable = 2U;
  config.node_capacity = 3U;
  return config;
}

} // namespace

TEST_CASE("a leader collects scores and deterministically assigns the strongest candidate") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(40);
  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  REQUIRE(controller.initiateMission(Coordinate(10.0F, 20.0F), 1U));
  REQUIRE(controller.state() == ControllerState::Leading);
  REQUIRE(transport.sent.size() == 1U);
  CHECK(transport.sent.front().type == MessageType::MissionRequest);

  transport.deliver(Message::candidacy(1, 0, controller.currentMissionId(), 80));
  transport.deliver(Message::candidacy(2, 0, controller.currentMissionId(), 80));
  controller.update(2U);
  REQUIRE(transport.sent.size() == 3U);
  CHECK(transport.sent[1].type == MessageType::Acknowledgement);
  CHECK(transport.sent[2].type == MessageType::Acknowledgement);

  controller.update(101U);
  CHECK(controller.state() == ControllerState::Idle);
  CHECK(controller.assignedNode() == 1U);
  CHECK(transport.sent.back().type == MessageType::MissionAssignment);
  CHECK(transport.sent.back().target == 1U);
}

TEST_CASE("a candidate progresses from request to acknowledgement to assignment") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(73);
  SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  transport.deliver(Message::missionRequest(0, 17, Coordinate(-20.0F, 30.0F)));
  controller.update(5U);
  REQUIRE(controller.state() == ControllerState::AwaitingAcknowledgement);
  REQUIRE(transport.sent.size() == 1U);
  CHECK(transport.sent.back().score == 73U);
  CHECK(transport.sent.back().target == 0U);

  transport.deliver(Message::acknowledgement(0, 2, 17));
  controller.update(6U);
  CHECK(controller.state() == ControllerState::AwaitingAssignment);

  transport.deliver(Message::assignment(0, 2, 17));
  controller.update(7U);
  CHECK(controller.state() == ControllerState::Active);
  CHECK(controller.assignedNode() == 2U);

  controller.completeMission();
  CHECK(controller.state() == ControllerState::Idle);
}

TEST_CASE("an active node does not volunteer for another mission") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(73);
  SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());
  transport.deliver(Message::missionRequest(0, 17, Coordinate()));
  controller.update(0U);
  transport.deliver(Message::acknowledgement(0, 2, 17));
  transport.deliver(Message::assignment(0, 2, 17));
  controller.update(1U);
  REQUIRE(controller.state() == ControllerState::Active);
  transport.sent.clear();

  transport.deliver(Message::missionRequest(1, 99, Coordinate()));
  controller.update(2U);
  CHECK(controller.state() == ControllerState::Active);
  CHECK(transport.sent.empty());

  CHECK_FALSE(controller.initiateMission(Coordinate(10.0F, 20.0F), 3U));
  CHECK(controller.state() == ControllerState::Active);
  CHECK(controller.currentMissionId() == 17U);
  CHECK(transport.sent.empty());
}

TEST_CASE("repeated unacknowledged candidacy triggers a latched safe-disabled state") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(50);
  SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  transport.deliver(Message::missionRequest(0, 1, Coordinate()));
  controller.update(0U);
  controller.update(10U);
  controller.update(20U);
  REQUIRE(controller.state() == ControllerState::Idle);
  REQUIRE(controller.consecutiveCommunicationFailures() == 1U);

  transport.deliver(Message::missionRequest(0, 2, Coordinate()));
  controller.update(30U);
  controller.update(40U);
  controller.update(50U);
  CHECK(controller.state() == ControllerState::SafeDisabled);

  health.current = HealthStatus::Nominal;
  controller.update(1000U);
  CHECK(controller.state() == ControllerState::SafeDisabled);
}

TEST_CASE("health monitoring supports reversible quiescence and irreversible fatal disablement") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(50);
  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  health.current = HealthStatus::Quiescent;
  controller.update(0U);
  CHECK(controller.state() == ControllerState::Quiescent);

  health.current = HealthStatus::Nominal;
  controller.update(1U);
  CHECK(controller.state() == ControllerState::Idle);

  health.current = HealthStatus::Fatal;
  controller.update(2U);
  CHECK(controller.state() == ControllerState::SafeDisabled);
  health.current = HealthStatus::Nominal;
  controller.update(3U);
  CHECK(controller.state() == ControllerState::SafeDisabled);
}

TEST_CASE("elapsed-time checks remain correct across a 32-bit clock rollover") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(50);
  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());
  const uint32_t start = std::numeric_limits<uint32_t>::max() - 49U;

  REQUIRE(controller.initiateMission(Coordinate(), start));
  controller.update(60U);
  CHECK(controller.state() == ControllerState::Active);
  CHECK(controller.assignedNode() == 0U);
}

TEST_CASE("invalid missions and out-of-range node identifiers are rejected") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(50);
  SwarmController invalid_node(9, SatelliteSnapshot(), transport, health, scorer, fastConfig());
  CHECK_FALSE(invalid_node.initiateMission(Coordinate(), 0U));
  CHECK(invalid_node.state() == ControllerState::SafeDisabled);
  transport.deliver(Message::missionRequest(0, 1, Coordinate()));
  invalid_node.update(1U);
  CHECK(transport.sent.empty());

  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());
  CHECK_FALSE(controller.initiateMission(Coordinate(0.0F, 91.0F), 0U));
}

TEST_CASE("zero-valued controller limits are normalized to safe operating bounds") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(50);
  ControllerConfig config = fastConfig();
  config.node_capacity = 0U;
  config.maximum_attempts = 0U;
  config.failed_missions_before_safe_disable = 0U;
  SwarmController controller(kMaximumNodes - 1U, SatelliteSnapshot(), transport, health, scorer,
                             config);

  transport.deliver(Message::missionRequest(0, 1, Coordinate()));
  controller.update(0U);
  REQUIRE(controller.state() == ControllerState::AwaitingAcknowledgement);

  controller.update(config.retry_interval_ms);
  CHECK(controller.state() == ControllerState::SafeDisabled);
}

TEST_CASE("an assignment to an out-of-range node is ignored") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(73);
  SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  transport.deliver(Message::missionRequest(0, 17, Coordinate()));
  controller.update(0U);
  transport.deliver(Message::acknowledgement(0, 2, 17));
  controller.update(1U);
  REQUIRE(controller.state() == ControllerState::AwaitingAssignment);

  transport.deliver(Message::assignment(0, 99, 17));
  controller.update(2U);
  CHECK(controller.state() == ControllerState::AwaitingAssignment);
  CHECK(controller.assignedNode() == kBroadcastNode);
}

TEST_CASE("transport rejection does not masquerade as protocol progress") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(73);
  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  transport.send_succeeds = false;
  CHECK_FALSE(controller.initiateMission(Coordinate(), 0U));
  CHECK(controller.state() == ControllerState::Idle);
  CHECK(controller.currentMissionId() == 0U);

  transport.deliver(Message::missionRequest(1, 17, Coordinate()));
  controller.update(1U);
  CHECK(controller.state() == ControllerState::Idle);
  CHECK(controller.consecutiveCommunicationFailures() == 0U);
}

TEST_CASE("a failed assignment send aborts the local negotiation") {
  FakeTransport transport;
  FakeHealthMonitor health;
  FixedScorer scorer(40);
  SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());

  REQUIRE(controller.initiateMission(Coordinate(), 0U));
  transport.deliver(Message::candidacy(1, 0, controller.currentMissionId(), 80));
  controller.update(1U);
  transport.send_succeeds = false;
  controller.update(100U);

  CHECK(controller.state() == ControllerState::Idle);
  CHECK(controller.assignedNode() == kBroadcastNode);
}

TEST_CASE("messages queued at or after a phase deadline are ignored") {
  SECTION("late candidacy") {
    FakeTransport transport;
    FakeHealthMonitor health;
    FixedScorer scorer(40);
    SwarmController controller(0, SatelliteSnapshot(), transport, health, scorer, fastConfig());

    REQUIRE(controller.initiateMission(Coordinate(), 0U));
    transport.deliver(Message::candidacy(1, 0, controller.currentMissionId(), 80));
    controller.update(100U);

    CHECK(controller.state() == ControllerState::Active);
    CHECK(controller.assignedNode() == 0U);
  }

  SECTION("late acknowledgement") {
    FakeTransport transport;
    FakeHealthMonitor health;
    FixedScorer scorer(40);
    SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());

    transport.deliver(Message::missionRequest(0, 17, Coordinate()));
    controller.update(0U);
    controller.update(10U);
    transport.deliver(Message::acknowledgement(0, 2, 17));
    controller.update(20U);

    CHECK(controller.state() == ControllerState::Idle);
    CHECK(controller.consecutiveCommunicationFailures() == 1U);
  }

  SECTION("late assignment") {
    FakeTransport transport;
    FakeHealthMonitor health;
    FixedScorer scorer(40);
    SwarmController controller(2, SatelliteSnapshot(), transport, health, scorer, fastConfig());

    transport.deliver(Message::missionRequest(0, 17, Coordinate()));
    controller.update(0U);
    transport.deliver(Message::acknowledgement(0, 2, 17));
    controller.update(1U);
    REQUIRE(controller.state() == ControllerState::AwaitingAssignment);
    transport.deliver(Message::assignment(0, 2, 17));
    controller.update(101U);

    CHECK(controller.state() == ControllerState::Idle);
    CHECK(controller.assignedNode() == kBroadcastNode);
  }
}
