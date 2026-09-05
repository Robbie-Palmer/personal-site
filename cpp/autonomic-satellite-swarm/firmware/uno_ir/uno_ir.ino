#include "src/uno_ir_transport.hpp"

#include <satellite_swarm/satellite_swarm.hpp>

#ifndef SATELLITE_SWARM_NODE_ID
#error "Define SATELLITE_SWARM_NODE_ID through the firmware build task"
#endif

namespace {

static_assert(SATELLITE_SWARM_NODE_ID >= 0 &&
                  SATELLITE_SWARM_NODE_ID < satellite_swarm::kMaximumNodes,
              "SATELLITE_SWARM_NODE_ID must identify a configured swarm node");
constexpr uint8_t kNodeId = SATELLITE_SWARM_NODE_ID;
const uint8_t kReceivePin = A4;
const uint8_t kSendPin = 3;
const uint8_t kMissionButtonPin = 2;
const uint32_t kButtonDebounceMs = 250U;

class NominalHealthMonitor : public satellite_swarm::HealthMonitor {
public:
  satellite_swarm::HealthStatus poll() override { return satellite_swarm::HealthStatus::Nominal; }
};

UnoInfraredTransport transport(kReceivePin, kSendPin);
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

void updateStatusLed() {
  const bool on = controller.state() == satellite_swarm::ControllerState::Active ||
                  controller.state() == satellite_swarm::ControllerState::SafeDisabled;
  digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
}

} // namespace

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(kMissionButtonPin, INPUT_PULLUP);
  transport.begin();
  Serial.println(F("Autonomic Satellite Swarm: Arduino Uno/IR ready"));
}

void loop() {
  const uint32_t now_ms = millis();
  if (digitalRead(kMissionButtonPin) == LOW &&
      static_cast<uint32_t>(now_ms - last_button_press_ms) >= kButtonDebounceMs) {
    controller.initiateMission(satellite_swarm::Coordinate(0.0F, -90.0F), now_ms);
    last_button_press_ms = now_ms;
  }

  controller.update(now_ms);
  updateStatusLed();
  if (controller.state() != previous_state) {
    Serial.print(F("State: "));
    Serial.println(static_cast<uint8_t>(controller.state()));
    previous_state = controller.state();
  }
}
