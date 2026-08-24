#!/usr/bin/env bash
set -uo pipefail

# Keeps the media automation stack (Prowlarr, Sonarr, Radarr, qBittorrent)
# running under launchd. Re-checks every 60 seconds, starting the VM and the
# compose stack if either has stopped, so the stack self-heals across hub
# reboots and crashes. Runs forever; launchd's KeepAlive restarts it if it
# ever exits.
#
# The stack is only brought up while the hub's default route runs through a
# VPN tunnel interface (utun*); see ADR 020. Until a tunnel appears, the VM
# still starts but the containers are held back, cycle by cycle.
#
# Every cycle also reports health gauges to Netdata's local StatsD listener
# (see health.d/media_automation.conf): one per service endpoint, one for the
# VPN tunnel itself, and one for each container's Docker health status. A
# container that stays unhealthy for UNHEALTHY_RESTART_THRESHOLD consecutive
# cycles is restarted here — a hung process never exits, so Docker's own
# restart policy never fires for it.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DOCKER_CONTEXT="colima"

MEDIA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_INTERVAL_SECONDS="${CHECK_INTERVAL_SECONDS:-60}"
UNHEALTHY_RESTART_THRESHOLD="${UNHEALTHY_RESTART_THRESHOLD:-3}"
LOG_TS="+%F %T"
STATSD_HOST="${STATSD_HOST:-127.0.0.1}"
STATSD_PORT="${STATSD_PORT:-8125}"

# Consecutive unhealthy cycles per container. Two parallel indexed arrays
# instead of an associative array: launchd runs this under /bin/bash, and
# macOS's bash 3.2 predates declare -A.
UNHEALTHY_NAMES=()
UNHEALTHY_COUNTS=()

unhealthy_count() {
  local i name="$1"
  for ((i = 0; i < ${#UNHEALTHY_NAMES[@]}; i++)); do
    if [[ "${UNHEALTHY_NAMES[$i]}" == "$name" ]]; then
      echo "${UNHEALTHY_COUNTS[$i]}"
      return 0
    fi
  done
  echo 0
}

unhealthy_set() {
  local i name="$1" count="$2"
  for ((i = 0; i < ${#UNHEALTHY_NAMES[@]}; i++)); do
    if [[ "${UNHEALTHY_NAMES[$i]}" == "$name" ]]; then
      UNHEALTHY_COUNTS[$i]="$count"
      return 0
    fi
  done
  UNHEALTHY_NAMES+=("$name")
  UNHEALTHY_COUNTS+=("$count")
}

colima_running() {
  if colima status >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

vpn_tunnel_active() {
  local iface
  iface="$(route -n get 1.1.1.1 2>/dev/null | awk '/^ *interface:/{print $2}')"
  if [[ "$iface" == utun* ]]; then
    return 0
  fi
  return 1
}

# Any HTTP response at all means the process is alive and serving; the
# status code is irrelevant (qBittorrent returns 401 without a session).
service_up() {
  local url="$1" code=""
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)" || return 1
  [[ "$code" =~ ^[0-9]+$ ]]
}

# Netdata's StatsD gauges decay to zero within seconds of the last packet, so
# each reading is resent every GAUGE_RESEND_SECONDS to keep charts warm
# between probes.
GAUGE_RESEND_SECONDS="${GAUGE_RESEND_SECONDS:-10}"
declare -a LAST_GAUGES=()

gauge() {
  local name="$1" value="$2"
  # Netdata's StatsD listener takes "<name>:<value>|g" per the StatsD
  # protocol; a comma instead of a colon parses as a DogStatsD tag and the
  # value never registers.
  printf '%s:%s|g\n' "$name" "$value" > "/dev/udp/${STATSD_HOST}/${STATSD_PORT}"
  return 0
}

resend_gauges() {
  local line
  for line in ${LAST_GAUGES[@]+"${LAST_GAUGES[@]}"}; do
    printf '%s\n' "$line" > "/dev/udp/${STATSD_HOST}/${STATSD_PORT}"
  done
  return 0
}

report_gauges() {
  local fresh=()
  fresh+=("media_tunnel_up:$(vpn_tunnel_active && echo 1 || echo 0)|g")
  fresh+=("media_jellyfin_up:$(service_up http://localhost:8096/health && echo 1 || echo 0)|g")
  fresh+=("media_sonarr_up:$(service_up http://localhost:8989/ping && echo 1 || echo 0)|g")
  fresh+=("media_radarr_up:$(service_up http://localhost:7878/ping && echo 1 || echo 0)|g")
  fresh+=("media_prowlarr_up:$(service_up http://localhost:9696/ping && echo 1 || echo 0)|g")
  fresh+=("media_qbittorrent_up:$(service_up http://localhost:8080/api/v2/app/version && echo 1 || echo 0)|g")
  LAST_GAUGES=("${fresh[@]}")
  return 0
}

# Restarts containers that Docker marks unhealthy for too many consecutive
# cycles, and appends every tracked container's health as a gauge line.
watch_container_health() {
  local name health
  while IFS=$'\t' read -r name health; do
    name="${name#/}"
    [[ -n "$name" ]] || continue
    if [[ "$health" == "unhealthy" ]]; then
      cycles="$(unhealthy_count "$name")"
      cycles=$((cycles + 1))
      unhealthy_set "$name" "$cycles"
      if (( cycles >= UNHEALTHY_RESTART_THRESHOLD )); then
        echo "$(date "$LOG_TS") $name unhealthy $cycles cycles; restarting" >&2
        docker restart "$name" >/dev/null 2>&1 \
          && unhealthy_set "$name" 0 \
          || echo "$(date "$LOG_TS") $name restart failed; retrying next cycle" >&2
      fi
    else
      unhealthy_set "$name" 0
    fi
    # Containers without a health check count as healthy: "unhealthy" means
    # Docker's probe failed, and that is the only state worth alerting on.
    if [[ "$health" == "healthy" || "$health" == "running" ]]; then
      LAST_GAUGES+=("media_${name//-/_}_container_healthy:1|g")
    else
      LAST_GAUGES+=("media_${name//-/_}_container_healthy:0|g")
    fi
  done < <(docker ps -q 2>/dev/null \
    | xargs -n 25 docker inspect \
      --format '{{.Name}}{{"\t"}}{{if .State.Health}}{{.State.Health.Status}}{{else if .State.Running}}running{{else}}stopped{{end}}' 2>/dev/null)
  return 0
}

while true; do
  report_gauges
  watch_container_health
  resend_gauges

  if ! colima_running; then
    echo "$(date "$LOG_TS") colima is not running; starting it" >&2
    colima start \
      --vm-type vz \
      --mount-type virtiofs \
      --cpu "${COLIMA_CPU:-4}" \
      --memory "${COLIMA_MEMORY:-4}" \
      --mount "${HOME}:w" \
      --mount "/Volumes:w" >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") colima start failed; retrying next cycle" >&2
  fi

  if colima_running && vpn_tunnel_active; then
    docker compose \
      --project-directory "$MEDIA_DIR" \
      up -d >/dev/null 2>&1 \
      || echo "$(date "$LOG_TS") docker compose up failed; retrying next cycle" >&2
  elif colima_running; then
    echo "$(date "$LOG_TS") no VPN tunnel on the default route; holding the stack (ADR 020)" >&2
  fi

  remaining="$CHECK_INTERVAL_SECONDS"
  while (( remaining > 0 )); do
    if (( remaining < GAUGE_RESEND_SECONDS )); then
      sleep "$remaining"
      remaining=0
    else
      sleep "$GAUGE_RESEND_SECONDS"
      (( remaining -= GAUGE_RESEND_SECONDS ))
    fi
    resend_gauges
  done
done
