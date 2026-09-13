#include "satellite_swarm/telemetry.hpp"

namespace satellite_swarm {

void BoundedTelemetryBuffer::countDrop() {
  if (dropped_events_ != UINT32_MAX) {
    ++dropped_events_;
  }
}

void BoundedTelemetryBuffer::erase(uint8_t index) {
  if (index >= size_) {
    return;
  }
  for (uint8_t current = index; current + 1U < size_; ++current) {
    events_[current] = events_[static_cast<uint8_t>(current + 1U)];
  }
  --size_;
}

bool BoundedTelemetryBuffer::record(TelemetryEvent event) {
  if (next_sequence_ == 0U) {
    countDrop();
    return false;
  }

  event.sequence = next_sequence_;
  next_sequence_ = next_sequence_ == UINT32_MAX ? 0U : next_sequence_ + 1U;

  if (size_ == kTelemetryBufferCapacity) {
    uint8_t eviction = kTelemetryBufferCapacity;
    TelemetryPriority lowest_priority = event.priority;
    for (uint8_t index = 0U; index < size_; ++index) {
      if (events_[index].priority < event.priority &&
          (eviction == kTelemetryBufferCapacity || events_[index].priority < lowest_priority)) {
        eviction = index;
        lowest_priority = events_[index].priority;
      }
    }
    if (eviction == kTelemetryBufferCapacity) {
      countDrop();
      return false;
    }
    erase(eviction);
    countDrop();
  }

  event.dropped_before = dropped_events_;
  events_[size_] = event;
  ++size_;
  return true;
}

bool BoundedTelemetryBuffer::read(TelemetryEvent& event) {
  if (size_ == 0U) {
    return false;
  }
  event = events_[0];
  erase(0U);
  return true;
}

} // namespace satellite_swarm
