#ifndef SATELLITE_SWARM_ESPNOW_TRANSPORT_HPP
#define SATELLITE_SWARM_ESPNOW_TRANSPORT_HPP

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <satellite_swarm/interfaces.hpp>
#include <satellite_swarm/wire_codec.hpp>

class EspNowTransport : public satellite_swarm::Transport {
public:
  EspNowTransport();

  bool begin();
  bool send(const satellite_swarm::Message& message) override;
  bool receive(satellite_swarm::Message& message) override;

private:
  static const uint8_t kQueueDepth = 4;
  static EspNowTransport* instance_;

  StaticQueue_t queue_control_;
  uint8_t queue_storage_[kQueueDepth * sizeof(satellite_swarm::Message)];
  QueueHandle_t queue_;

  static void onReceive(const esp_now_recv_info_t* info, const uint8_t* data, int length);
};

#endif
