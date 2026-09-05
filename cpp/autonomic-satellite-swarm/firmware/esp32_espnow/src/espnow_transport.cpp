#include "espnow_transport.hpp"

#include <array>
#include <cstring>

namespace {

constexpr std::array<uint8_t, ESP_NOW_ETH_ALEN> kBroadcastAddress = {0xFFU, 0xFFU, 0xFFU,
                                                                     0xFFU, 0xFFU, 0xFFU};

} // namespace

EspNowTransport* EspNowTransport::instance_ = nullptr;

EspNowTransport::EspNowTransport()
    : queue_(xQueueCreateStatic(kQueueDepth, sizeof(satellite_swarm::Message),
                                queue_storage_.data(), &queue_control_)) {}

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
  std::memcpy(peer.peer_addr, kBroadcastAddress.data(), kBroadcastAddress.size());
  peer.channel = 0;
  peer.ifidx = WIFI_IF_STA;
  peer.encrypt = false;
  if (!esp_now_is_peer_exist(kBroadcastAddress.data()) && esp_now_add_peer(&peer) != ESP_OK) {
    esp_now_unregister_recv_cb();
    esp_now_deinit();
    instance_ = nullptr;
    return false;
  }
  initialized_ = true;
  return true;
}

bool EspNowTransport::send(const satellite_swarm::Message& message) {
  if (!initialized_) {
    return false;
  }
  std::array<uint8_t, satellite_swarm::WireCodec::kPacketSize> packet{};
  if (!satellite_swarm::WireCodec::encode(message, packet.data(), packet.size())) {
    return false;
  }
  return esp_now_send(kBroadcastAddress.data(), packet.data(), packet.size()) == ESP_OK;
}

bool EspNowTransport::receive(satellite_swarm::Message& message) {
  if (!initialized_) {
    return false;
  }
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
