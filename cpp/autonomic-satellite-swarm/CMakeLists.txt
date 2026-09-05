cmake_minimum_required(VERSION 3.25)

project(
  autonomic_satellite_swarm
  VERSION 2.0.0
  DESCRIPTION "A portable research prototype for fail-safe satellite swarm coordination"
  LANGUAGES CXX)

include(CTest)
include(FetchContent)

option(SATELLITE_SWARM_BUILD_SIMULATION "Build the deterministic host simulation" ON)
option(SATELLITE_SWARM_ENABLE_SANITIZERS "Enable address and undefined-behavior sanitizers" OFF)

add_library(
  satellite_swarm
  src/satellite_swarm/controller.cpp
  src/satellite_swarm/historical_orbital_scorer.cpp
  src/satellite_swarm/types.cpp
  src/satellite_swarm/wire_codec.cpp)
add_library(satellite_swarm::coordination ALIAS satellite_swarm)

target_include_directories(
  satellite_swarm
  PUBLIC $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
         $<INSTALL_INTERFACE:include>)
target_compile_features(satellite_swarm PUBLIC cxx_std_20)

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
  target_compile_options(
    satellite_swarm
    PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Wshadow
            -Wnon-virtual-dtor -Wold-style-cast -Woverloaded-virtual)
endif()

if(SATELLITE_SWARM_ENABLE_SANITIZERS AND CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
  target_compile_options(satellite_swarm PUBLIC -fno-omit-frame-pointer -fsanitize=address,undefined)
  target_link_options(satellite_swarm PUBLIC -fno-omit-frame-pointer -fsanitize=address,undefined)
endif()

if(SATELLITE_SWARM_BUILD_SIMULATION)
  add_executable(autonomic-satellite-swarm-simulation examples/simulation/main.cpp)
  target_link_libraries(autonomic-satellite-swarm-simulation PRIVATE satellite_swarm::coordination)
endif()

if(BUILD_TESTING)
  FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.16.0
    GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(Catch2)

  add_executable(
    satellite_swarm_tests
    tests/controller_test.cpp
    tests/historical_orbital_scorer_test.cpp
    tests/wire_codec_test.cpp)
  target_link_libraries(
    satellite_swarm_tests
    PRIVATE satellite_swarm::coordination Catch2::Catch2WithMain)

  if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(
      satellite_swarm_tests
      PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion -Wshadow)
  endif()

  include(Catch)
  catch_discover_tests(satellite_swarm_tests)
endif()
