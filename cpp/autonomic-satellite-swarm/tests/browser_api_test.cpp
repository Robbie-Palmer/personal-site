#include "satellite_swarm/browser_api.hpp"

#include <catch2/catch_test_macros.hpp>
#include <string>

TEST_CASE("the browser bridge exposes a versioned JSON result") {
  CHECK(satellite_swarm_browser_api_version() == 1U);

  const char* result = satellite_swarm_run_demonstration(12.5F, -45.25F);
  REQUIRE(result != nullptr);
  const std::string json(result);
  CHECK(json.find(R"("source": "portable C++ SimulationTrace")") != std::string::npos);
  CHECK(json.find(R"("objective": {"longitudeDegrees":12.5,"latitudeDegrees":-45.25})") !=
        std::string::npos);
  CHECK(std::string(satellite_swarm_last_error()).empty());
}

TEST_CASE("the browser bridge reports invalid input without unwinding across C") {
  CHECK(satellite_swarm_run_demonstration(181.0F, 0.0F) == nullptr);
  CHECK(std::string(satellite_swarm_last_error()) ==
        "mission objective is outside the coordinate bounds");

  CHECK(satellite_swarm_run_demonstration(0.0F, -90.0F) != nullptr);
  CHECK(std::string(satellite_swarm_last_error()).empty());
}
