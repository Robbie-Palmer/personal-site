#include "src/espnow_transport.hpp"

#include <satellite_swarm/satellite_swarm.hpp>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

namespace {

const uint8_t kNodeId = 0;
const uint8_t kMissionButtonPin = 0;
const uint32_t kButtonDebounceMs = 250U;

class NominalHealthMonitor : public satellite_swarm::HealthMonitor {
public:
  satellite_swarm::HealthStatus poll() override { return satellite_swarm::HealthStatus::Nominal; }
};

EspNowTransport transport;
NominalHealthMonitor health_monitor;
satellite_swarm::HistoricalOrbitalScorer scorer;
satellite_swarm::SatelliteSnapshot makeSatellite() {
  satellite_swarm::SatelliteSnapshot value;
  value.coordinate = satellite_swarm::Coordinate(0.0F, 90.0F);
  return value;
}
satellite_swarm::ControllerConfig makeConfig() {
  satellite_swarm::ControllerConfig value;
  value.node_capacity = 3U;
  return value;
}
satellite_swarm::SatelliteSnapshot satellite = makeSatellite();
satellite_swarm::ControllerConfig config = makeConfig();
satellite_swarm::SwarmController controller(kNodeId, satellite, transport, health_monitor, scorer,
                                            config);
satellite_swarm::ControllerState previous_state = satellite_swarm::ControllerState::Idle;
uint32_t last_button_press_ms = 0;
bool transport_ready = false;

} // namespace

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(kMissionButtonPin, INPUT_PULLUP);
  transport_ready = transport.begin();
  if (!transport_ready) {
    Serial.println("ESP-NOW initialization failed");
    digitalWrite(LED_BUILTIN, HIGH);
    return;
  }
  Serial.println("Autonomic Satellite Swarm: ESP32/ESP-NOW ready");
}

void loop() {
  if (!transport_ready) {
    delay(1000U);
    return;
  }

  const uint32_t now_ms = millis();
  if (digitalRead(kMissionButtonPin) == LOW &&
      static_cast<uint32_t>(now_ms - last_button_press_ms) >= kButtonDebounceMs) {
    controller.initiateMission(satellite_swarm::Coordinate(0.0F, -90.0F), now_ms);
    last_button_press_ms = now_ms;
  }

  controller.update(now_ms);
  digitalWrite(LED_BUILTIN,
               controller.state() == satellite_swarm::ControllerState::Active ? HIGH : LOW);
  if (controller.state() != previous_state) {
    Serial.printf("State: %u\n", static_cast<unsigned int>(controller.state()));
    previous_state = controller.state();
  }
  delay(1U);
}
