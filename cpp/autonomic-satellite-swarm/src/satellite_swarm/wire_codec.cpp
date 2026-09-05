#include "satellite_swarm/wire_codec.hpp"

#include <math.h>

namespace satellite_swarm {
namespace {

const uint8_t kMagicAndVersion = 0xA1;
const float kCoordinateScale = 100.0F;

void writeInt16(int16_t value, uint8_t* output) {
  const uint16_t bits = static_cast<uint16_t>(value);
  output[0] = static_cast<uint8_t>(bits >> 8U);
  output[1] = static_cast<uint8_t>(bits & 0xFFU);
}

int16_t readInt16(const uint8_t* input) {
  const uint16_t bits = static_cast<uint16_t>(static_cast<uint16_t>(input[0]) << 8U) |
                        static_cast<uint16_t>(input[1]);
  return static_cast<int16_t>(bits);
}

bool isKnownMessageType(uint8_t type) {
  return type >= static_cast<uint8_t>(MessageType::MissionRequest) &&
         type <= static_cast<uint8_t>(MessageType::MissionAssignment);
}

} // namespace

bool WireCodec::encode(const Message& message, uint8_t* output, size_t output_size) {
  if (output == nullptr || output_size != kPacketSize ||
      !isKnownMessageType(static_cast<uint8_t>(message.type)) || !isValid(message.objective) ||
      message.score > 100U) {
    return false;
  }

  output[0] = kMagicAndVersion;
  output[1] = static_cast<uint8_t>(message.type);
  output[2] = message.origin;
  output[3] = message.target;
  output[4] = static_cast<uint8_t>(message.mission_id >> 8U);
  output[5] = static_cast<uint8_t>(message.mission_id & 0xFFU);
  writeInt16(static_cast<int16_t>(lroundf(message.objective.longitude_degrees * kCoordinateScale)),
             &output[6]);
  writeInt16(static_cast<int16_t>(lroundf(message.objective.latitude_degrees * kCoordinateScale)),
             &output[8]);
  output[10] = message.score;
  output[11] = checksum(output, kPacketSize - 1U);
  return true;
}

bool WireCodec::decode(const uint8_t* packet, size_t packet_size, Message& message) {
  if (packet == nullptr || packet_size != kPacketSize || packet[0] != kMagicAndVersion ||
      !isKnownMessageType(packet[1]) || packet[10] > 100U ||
      packet[11] != checksum(packet, kPacketSize - 1U)) {
    return false;
  }

  Message decoded;
  decoded.type = static_cast<MessageType>(packet[1]);
  decoded.origin = packet[2];
  decoded.target = packet[3];
  decoded.mission_id = static_cast<MissionId>(static_cast<uint16_t>(packet[4]) << 8U) |
                       static_cast<MissionId>(packet[5]);
  decoded.objective.longitude_degrees =
      static_cast<float>(readInt16(&packet[6])) / kCoordinateScale;
  decoded.objective.latitude_degrees = static_cast<float>(readInt16(&packet[8])) / kCoordinateScale;
  decoded.score = packet[10];
  if (!isValid(decoded.objective)) {
    return false;
  }

  message = decoded;
  return true;
}

uint8_t WireCodec::checksum(const uint8_t* bytes, size_t size) {
  uint8_t crc = 0;
  for (size_t index = 0; index < size; ++index) {
    crc ^= bytes[index];
    for (uint8_t bit = 0; bit < 8U; ++bit) {
      const uint8_t shifted = static_cast<uint8_t>(static_cast<uint16_t>(crc) << 1U);
      crc = (crc & 0x80U) != 0U ? static_cast<uint8_t>(shifted ^ uint8_t{0x07}) : shifted;
    }
  }
  return crc;
}

} // namespace satellite_swarm
