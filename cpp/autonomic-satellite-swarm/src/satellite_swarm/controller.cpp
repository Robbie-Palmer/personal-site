#include "satellite_swarm/controller.hpp"

namespace satellite_swarm {

SwarmController::SwarmController(NodeId node_id, const SatelliteSnapshot& satellite,
                                 Transport& transport, HealthMonitor& health_monitor,
                                 const CandidacyScorer& scorer, const ControllerConfig& config)
    : node_id_(node_id), satellite_(satellite), transport_(transport),
      health_monitor_(health_monitor), scorer_(scorer), config_(config),
      state_(ControllerState::Idle), next_mission_id_(1), assigned_node_(kBroadcastNode),
      phase_started_at_ms_(0), last_attempt_at_ms_(0), attempts_(0), communication_failures_(0),
      candidates_() {
  if (config_.node_capacity == 0U || config_.node_capacity > kMaximumNodes) {
    config_.node_capacity = kMaximumNodes;
  }
  if (config_.maximum_attempts == 0U) {
    config_.maximum_attempts = 1U;
  }
  if (config_.failed_missions_before_safe_disable == 0U) {
    config_.failed_missions_before_safe_disable = 1U;
  }
  resetCandidates();
  if (node_id_ >= config_.node_capacity) {
    state_ = ControllerState::SafeDisabled;
  }
}

bool SwarmController::initiateMission(const Coordinate& objective, uint32_t now_ms) {
  if (state_ != ControllerState::Idle || node_id_ >= config_.node_capacity || !isValid(objective)) {
    return false;
  }

  current_mission_ = Message::missionRequest(node_id_, next_mission_id_, objective);
  ++next_mission_id_;
  if (next_mission_id_ == 0U) {
    next_mission_id_ = 1U;
  }

  resetCandidates();
  candidates_[node_id_].received = true;
  candidates_[node_id_].score = scorer_.score(satellite_, objective);
  assigned_node_ = kBroadcastNode;
  phase_started_at_ms_ = now_ms;
  state_ = ControllerState::Leading;
  transport_.send(current_mission_);
  return true;
}

void SwarmController::update(uint32_t now_ms) {
  const HealthStatus health = health_monitor_.poll();
  if (health == HealthStatus::Fatal) {
    state_ = ControllerState::SafeDisabled;
    return;
  }
  if (state_ == ControllerState::SafeDisabled) {
    return;
  }
  if (health == HealthStatus::Quiescent) {
    state_ = ControllerState::Quiescent;
    return;
  }
  if (state_ == ControllerState::Quiescent) {
    state_ = ControllerState::Idle;
  }

  Message incoming;
  while (transport_.receive(incoming)) {
    process(incoming, now_ms);
    if (state_ == ControllerState::SafeDisabled || state_ == ControllerState::Quiescent) {
      return;
    }
  }

  if (state_ == ControllerState::Leading &&
      elapsed(now_ms, phase_started_at_ms_, config_.response_window_ms)) {
    finishLeading();
  } else if (state_ == ControllerState::AwaitingAcknowledgement &&
             elapsed(now_ms, last_attempt_at_ms_, config_.retry_interval_ms)) {
    if (attempts_ >= config_.maximum_attempts) {
      abandonUnacknowledgedMission();
    } else {
      sendCandidacy(now_ms);
    }
  } else if (state_ == ControllerState::AwaitingAssignment &&
             elapsed(now_ms, phase_started_at_ms_, config_.response_window_ms)) {
    state_ = ControllerState::Idle;
  }
}

void SwarmController::completeMission() {
  if (state_ == ControllerState::Active) {
    state_ = ControllerState::Idle;
    assigned_node_ = kBroadcastNode;
  }
}

void SwarmController::resetCandidates() {
  for (uint8_t index = 0; index < kMaximumNodes; ++index) {
    candidates_[index].received = false;
    candidates_[index].score = 0U;
  }
}

void SwarmController::process(const Message& message, uint32_t now_ms) {
  if (message.origin >= config_.node_capacity || message.origin == node_id_) {
    return;
  }

  switch (message.type) {
  case MessageType::MissionRequest:
    if (message.target == kBroadcastNode && isValid(message.objective)) {
      acceptMissionRequest(message, now_ms);
    }
    break;
  case MessageType::Candidacy:
    if (state_ == ControllerState::Leading && message.target == node_id_ &&
        message.mission_id == current_mission_.mission_id && message.score <= 100U) {
      candidates_[message.origin].received = true;
      candidates_[message.origin].score = message.score;
      transport_.send(Message::acknowledgement(node_id_, message.origin, message.mission_id));
    }
    break;
  case MessageType::Acknowledgement:
    if (state_ == ControllerState::AwaitingAcknowledgement && message.target == node_id_ &&
        matchesCurrentMission(message)) {
      communication_failures_ = 0U;
      phase_started_at_ms_ = now_ms;
      state_ = ControllerState::AwaitingAssignment;
    }
    break;
  case MessageType::MissionAssignment:
    if ((state_ == ControllerState::AwaitingAcknowledgement ||
         state_ == ControllerState::AwaitingAssignment) &&
        message.target < config_.node_capacity && matchesCurrentMission(message)) {
      assigned_node_ = message.target;
      state_ = message.target == node_id_ ? ControllerState::Active : ControllerState::Idle;
    }
    break;
  }
}

void SwarmController::acceptMissionRequest(const Message& request, uint32_t now_ms) {
  if (state_ != ControllerState::Idle) {
    return;
  }

  current_mission_ = request;
  attempts_ = 0U;
  phase_started_at_ms_ = now_ms;
  const uint8_t candidate_score = scorer_.score(satellite_, request.objective);
  candidates_[node_id_].score = candidate_score;
  sendCandidacy(now_ms);
}

void SwarmController::sendCandidacy(uint32_t now_ms) {
  transport_.send(Message::candidacy(node_id_, current_mission_.origin, current_mission_.mission_id,
                                     candidates_[node_id_].score));
  ++attempts_;
  last_attempt_at_ms_ = now_ms;
  state_ = ControllerState::AwaitingAcknowledgement;
}

void SwarmController::finishLeading() {
  NodeId chosen = node_id_;
  for (NodeId candidate = 0; candidate < config_.node_capacity; ++candidate) {
    if (candidates_[candidate].received &&
        candidates_[candidate].score > candidates_[chosen].score) {
      chosen = candidate;
    }
  }

  assigned_node_ = chosen;
  transport_.send(Message::assignment(node_id_, chosen, current_mission_.mission_id));
  state_ = chosen == node_id_ ? ControllerState::Active : ControllerState::Idle;
}

void SwarmController::abandonUnacknowledgedMission() {
  ++communication_failures_;
  if (communication_failures_ >= config_.failed_missions_before_safe_disable) {
    state_ = ControllerState::SafeDisabled;
  } else {
    state_ = ControllerState::Idle;
  }
}

bool SwarmController::matchesCurrentMission(const Message& message) const {
  return message.mission_id == current_mission_.mission_id &&
         message.origin == current_mission_.origin;
}

bool SwarmController::elapsed(uint32_t now_ms, uint32_t since_ms, uint32_t duration_ms) const {
  return now_ms - since_ms >= duration_ms;
}

} // namespace satellite_swarm
