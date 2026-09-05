#include "espnow_transport.hpp"

#include <cstring>

namespace {

const uint8_t kBroadcastAddress[ESP_NOW_ETH_ALEN] = {0xFFU, 0xFFU, 0xFFU, 0xFFU, 0xFFU, 0xFFU};

} // namespace

EspNowTransport* EspNowTransport::instance_ = nullptr;

EspNowTransport::EspNowTransport()
    : queue_control_(), queue_storage_(),
      queue_(xQueueCreateStatic(kQueueDepth, sizeof(satellite_swarm::Message), queue_storage_,
                                &queue_control_)) {}

bool EspNowTransport::begin() {
  if (instance_ != nullptr || queue_ == nullptr) {
    return false;
  }
  instance_ = this;
  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) {
    instance_ = nullptr;
    return false;
  }
  if (esp_now_register_recv_cb(onReceive) != ESP_OK) {
    esp_now_deinit();
    instance_ = nullptr;
    return false;
  }

  esp_now_peer_info_t peer = {};
  std::memcpy(peer.peer_addr, kBroadcastAddress, sizeof(kBroadcastAddress));
  peer.channel = 0;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  if (!esp_now_is_peer_exist(kBroadcastAddress) && esp_now_add_peer(&peer) != ESP_OK) {
    esp_now_unregister_recv_cb();
    esp_now_deinit();
    instance_ = nullptr;
    return false;
  }
  return true;
}

bool EspNowTransport::send(const satellite_swarm::Message& message) {
  uint8_t packet[satellite_swarm::WireCodec::kPacketSize];
  if (!satellite_swarm::WireCodec::encode(message, packet, sizeof(packet))) {
    return false;
  }
  return esp_now_send(kBroadcastAddress, packet, sizeof(packet)) == ESP_OK;
}

bool EspNowTransport::receive(satellite_swarm::Message& message) {
  return xQueueReceive(queue_, &message, 0) == pdTRUE;
}

void EspNowTransport::onReceive(const esp_now_recv_info_t*, const uint8_t* data, int length) {
  if (instance_ == nullptr || length != static_cast<int>(satellite_swarm::WireCodec::kPacketSize)) {
    return;
  }
  satellite_swarm::Message message;
  if (satellite_swarm::WireCodec::decode(data, static_cast<size_t>(length), message)) {
    xQueueSend(instance_->queue_, &message, 0);
  }
}
