#ifndef SATELLITE_SWARM_UNO_IR_TRANSPORT_HPP
#define SATELLITE_SWARM_UNO_IR_TRANSPORT_HPP

#include <Arduino.h>
#include <satellite_swarm/interfaces.hpp>
#include <satellite_swarm/wire_codec.hpp>

class UnoInfraredTransport : public satellite_swarm::Transport {
public:
  UnoInfraredTransport(uint8_t receive_pin, uint8_t send_pin);

  void begin();
  bool send(const satellite_swarm::Message& message) override;
  bool receive(satellite_swarm::Message& message) override;

private:
  static const uint8_t kChunkCount = 4;
  static const uint8_t kChunkBytes = 3;
  static const uint8_t kFramePrefix = 0xD0;
  static const uint32_t kAssemblyTimeoutMs = 250U;

  uint8_t receive_pin_;
  uint8_t send_pin_;
  uint8_t packet_[satellite_swarm::WireCodec::kPacketSize];
  uint8_t received_chunks_;
  uint32_t last_chunk_at_ms_;

  void resetAssembly();
};

#endif
