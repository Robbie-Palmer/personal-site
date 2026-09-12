#include "satellite_swarm/browser_api.hpp"

#include <catch2/catch_test_macros.hpp>
#include <string>

TEST_CASE("the browser bridge exposes a versioned JSON result") {
  CHECK(satellite_swarm_browser_api_version() == 2U);

  const char* result = satellite_swarm_run_demonstration(12.5F, -45.25F, 0U);
  REQUIRE(result != nullptr);
  const std::string json(result);
  CHECK(json.find(R"("source": "portable C++ SimulationTrace")") != std::string::npos);
  CHECK(json.find(R"("objective": {"longitudeDegrees":12.5,"latitudeDegrees":-45.25})") !=
        std::string::npos);
  CHECK(std::string(satellite_swarm_last_error()).empty());

  const char* fault_result = satellite_swarm_run_demonstration(0.0F, -90.0F, 1U);
  REQUIRE(fault_result != nullptr);
  CHECK(std::string(fault_result).find(R"("scenario": "three-node-assignment-loss")") !=
        std::string::npos);
}

TEST_CASE("the browser bridge reports invalid input without unwinding across C") {
  CHECK(satellite_swarm_run_demonstration(181.0F, 0.0F, 0U) == nullptr);
  CHECK(std::string(satellite_swarm_last_error()) ==
        "mission objective is outside the coordinate bounds");

  CHECK(satellite_swarm_run_demonstration(0.0F, -90.0F, 0U) != nullptr);
  CHECK(std::string(satellite_swarm_last_error()).empty());

  CHECK(satellite_swarm_run_demonstration(0.0F, -90.0F, 99U) == nullptr);
  CHECK(std::string(satellite_swarm_last_error()) == "unknown browser simulation scenario");
}
