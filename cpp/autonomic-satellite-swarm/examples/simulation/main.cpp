#include "satellite_swarm/satellite_swarm.hpp"

#include <array>
#include <cstdint>
#include <deque>
#include <iostream>

namespace {

using namespace satellite_swarm;

class SimulationTransport;

class SimulationBus {
public:
  void attach(SimulationTransport& transport);
  void broadcast(const SimulationTransport& sender, const Message& message);

private:
  std::array<SimulationTransport*, 3> transports_{};
  std::size_t size_ = 0;
};

class SimulationTransport : public Transport {
public:
  explicit SimulationTransport(SimulationBus& bus) : bus_(bus) { bus_.attach(*this); }

  bool send(const Message& message) override {
    bus_.broadcast(*this, message);
    return true;
  }

  bool receive(Message& message) override {
    if (inbox_.empty()) {
      return false;
    }
    message = inbox_.front();
    inbox_.pop_front();
    return true;
  }

  void deliver(const Message& message) { inbox_.push_back(message); }

private:
  SimulationBus& bus_;
  std::deque<Message> inbox_;
};

void SimulationBus::attach(SimulationTransport& transport) {
  if (size_ < transports_.size()) {
    transports_[size_] = &transport;
    ++size_;
  }
}

void SimulationBus::broadcast(const SimulationTransport& sender, const Message& message) {
  for (std::size_t index = 0; index < size_; ++index) {
    if (transports_[index] != &sender) {
      transports_[index]->deliver(message);
    }
  }
}

class NominalHealth : public HealthMonitor {
public:
  HealthStatus poll() override { return HealthStatus::Nominal; }
};

const char* stateName(ControllerState state) {
  switch (state) {
  case ControllerState::Idle:
    return "idle";
  case ControllerState::Leading:
    return "leading";
  case ControllerState::AwaitingAcknowledgement:
    return "awaiting acknowledgement";
  case ControllerState::AwaitingAssignment:
    return "awaiting assignment";
  case ControllerState::Active:
    return "active";
  case ControllerState::Quiescent:
    return "quiescent";
  case ControllerState::SafeDisabled:
    return "safe-disabled";
  }
  return "unknown";
}

SatelliteSnapshot satelliteAt(float longitude, float latitude) {
  SatelliteSnapshot satellite;
  satellite.coordinate = Coordinate(longitude, latitude);
  return satellite;
}

} // namespace

int main() {
  SimulationBus bus;
  SimulationTransport transport_0(bus);
  SimulationTransport transport_1(bus);
  SimulationTransport transport_2(bus);
  NominalHealth health_0;
  NominalHealth health_1;
  NominalHealth health_2;
  HistoricalOrbitalScorer scorer;
  ControllerConfig config;
  config.response_window_ms = 100U;
  config.node_capacity = 3U;

  SwarmController node_0(0, satelliteAt(3.0F, 90.0F), transport_0, health_0, scorer, config);
  SwarmController node_1(1, satelliteAt(0.0F, 90.0F), transport_1, health_1, scorer, config);
  SwarmController node_2(2, satelliteAt(1.0F, 90.0F), transport_2, health_2, scorer, config);
  std::array<SwarmController*, 3> nodes = {&node_0, &node_1, &node_2};

  if (!node_0.initiateMission(Coordinate(0.0F, -90.0F), 0U)) {
    std::cerr << "could not initiate simulation mission\n";
    return 1;
  }

  for (uint32_t now_ms = 0; now_ms <= 120U; now_ms += 10U) {
    for (SwarmController* node : nodes) {
      node->update(now_ms);
    }
  }

  std::cout << "Mission " << node_0.currentMissionId() << " assigned to node "
            << static_cast<unsigned int>(node_0.assignedNode()) << "\n";
  for (const SwarmController* node : nodes) {
    std::cout << "node " << static_cast<unsigned int>(node->nodeId()) << ": "
              << stateName(node->state()) << '\n';
  }

  return node_1.state() == ControllerState::Active ? 0 : 1;
}
