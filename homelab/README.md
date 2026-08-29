# Home Lab (code-as-config)

This directory declares the home lab's machines as code, following the layout
planned in [ADR 010](/projects/homelab/adrs/010-nixos-gpu-worker). The goal is
the same one that motivates the whole lab, the same config in produces the
same system out, every change is reviewable and rollbackable, and nothing is
hand-edited on a box that then forgets it.

All services are reachable only over the home LAN and the
[Tailscale](/projects/homelab/adrs/000-tailscale) tailnet. The router
forwards no ports, so nothing is ever public.

## Jellyfin on the Mac mini

Jellyfin (ADR 011) runs on the hub. A launchd agent keeps it running across
reboots and crashes.

### Jellyfin one-time bootstrap

Run on the hub with mise installed and Homebrew available:

```bash
mise run //homelab:bootstrap
```

The bootstrap will prompt you to create a `.env` file from the example
template and set `MEDIA_DIR` to your media library, then re-run.

Once complete it prints access URLs:

- **Local**: `http://localhost:8096`
- **LAN** (Fire TV Stick): `http://<hub-lan-ip>:8096`
- **Tailnet** (phone / laptop): `http://<hub-tailscale-ip>:8096`

Then add your media folders in the Jellyfin web UI: TV shows under
`/media/TV` and movies under `/media/Movies`.

### Jellyfin day-to-day

```bash
mise run //homelab:status
mise run //homelab:logs
mise run //homelab:restart
mise run //homelab:verify
```

### Jellyfin upgrading

1. Bump `JELLYFIN_VERSION` in `.env` (or pin an exact release).
2. `mise run //homelab:pull`

### Jellyfin caveats

- **Brief unauthenticated window on first bootstrap.** Between the stack
  starting and provisioning completing, Jellyfin's startup wizard is
  accessible on the port. The router forwards no ports and the tailnet is
  the lab's trust boundary, so this is only a risk if an untrusted peer is
  on the LAN during the few seconds bootstrap runs.
- **The drive must be mounted before bootstrap.** If the volume isn't
  connected or auto-mounted at login, the mount point won't exist.
- The [Netdata](/projects/homelab/adrs/009-netdata) alerting on the hub now
  covers the Jellyfin container (see the media automation section below);
  the media drive itself is the remaining gap, so a dead disk is only
  noticed when playback fails.

## Media automation on the Mac mini

The *arr stack (ADRs 016–019) feeds the Jellyfin library automatically:
[Prowlarr](/projects/homelab/adrs/017-prowlarr-indexer-management) manages
the torrent indexers and syncs them to Sonarr (TV) and Radarr (movies), which
send grabs to the containerized
[qBittorrent](/projects/homelab/adrs/018-single-containerized-torrent-client)
and import finished downloads into `/media/TV` and `/media/Movies` with
Jellyfin-friendly names.
[Recyclarr](/projects/homelab/adrs/019-recyclarr-trash-guides) keeps both
apps' quality profiles on the TRaSH Guides with a nightly sync. A launchd
agent (`homelab.media`) keeps all of it running across reboots, same as
Jellyfin's.

Web UIs (LAN/tailnet only): Prowlarr **9696**, Sonarr **8989**, Radarr
**7878**, qBittorrent **8080**. Login is `admin`; qBittorrent's password is
generated into the gitignored `.env`.

### Media automation one-time bootstrap

Run on the hub with mise installed and colima already set up by the Jellyfin
bootstrap. The media volume must be mounted first:

```bash
mise run //homelab:media-bootstrap
```

This creates `.env` from the example template, generates the qBittorrent
password, installs the launchd agent, starts the four containers, and runs
idempotent provisioning that wires download clients, root folders, indexers,
and the indexer sync between them.

### Media automation day-to-day

```bash
mise run //homelab:media-status
mise run //homelab:media-logs
mise run //homelab:media-restart
mise run //homelab:media-verify
mise run //homelab:media-provision   # re-run wiring; safe to repeat
```

### Media automation upgrading

1. Bump the `*_VERSION` pins in `.env` (or leave as `latest`).
2. `mise run //homelab:media-pull`

### Media automation caveats

- **Adding a series or film** happens in Sonarr/Radarr's UI (or their APIs);
  everything downstream is automatic. Or skip the UIs entirely: anything
  added to the [Trakt](https://trakt.tv) watchlist lands in the library on
  its own. See the recommendation-loop caveat below.
- **Recommendation loop (Trakt)**: watchlist taps flow into Sonarr/Radarr
  via their native "Trakt User" import lists, and the Jellyfin Trakt plugin
  scrobbles plays back so recommendations improve ([ADR 021](/projects/homelab/adrs/021-trakt-watchlist)).
  Each integration needs a one-time OAuth: in Radarr/Sonarr *Settings →
  Lists*, add "Trakt User", hit "Authenticate with Trakt"; in Jellyfin,
  Plugins → Trakt. Two traps: the list's username must match your profile
  slug exactly. Copy it from your Trakt profile URL (dashes, not
  underscores), since a misspelled one returns an empty watchlist instead of
  an error; and lists re-fetch at most every 12 hours, with failures
  counting as a sync, so delete + recreate the list to force an immediate
  retry while debugging.
- **qBittorrent bans IPs after five failed logins** for an hour. Scripts
  should try each credential once; if you lock yourself out,
  `docker restart qbittorrent` clears the ban list.
- **First provisioning needs a clean slate**: qBittorrent's temporary
  first-boot password comes from its logs, so wiping
  `data/qbittorrent/` and re-running bootstrap is the reset path.
- **New shared host directories require colima to know `/Volumes` is
  writable.** If a bind mount shows up read-only inside containers, check
  `writable: true` for `/Volumes` in `~/.colima/default/colima.yaml`, then
  `colima stop && colima start`.
- **New series and films need the right profile.** Recyclarr creates the
  TRaSH quality profiles; pick them (WEB 1080p for TV, HD Bluray + WEB for
  movies) when adding media. Items added before the profiles existed keep
  their old profile until switched manually.
- **Recyclarr sync runs nightly** (`@daily` in-container cron). Manual run:
  `docker exec recyclarr recyclarr sync`. Logs live in
  `data/recyclarr/logs/`.
- **The stack waits for the VPN.** Both provisioning and the keep-running
  agent refuse to start the containers until the hub's default route runs
  through a VPN tunnel interface, so torrent traffic never touches the
  residential line during the boot race ([ADR 020](/projects/homelab/adrs/020-vpn-gated-stack)).
- **Health gauges and alerts.** The keep-running agent probes every service
  endpoint each cycle (plus the VPN tunnel itself) and pushes 0/1 gauges into
  Netdata's local StatsD listener; it also restarts any container Docker marks
  unhealthy for three consecutive cycles, since a hung process never exits and
  Docker's own restart policy never fires for one.
  [`netdata/health.d/media_automation.conf`](hosts/mac-mini/netdata/health.d/media_automation.conf)
  turns those gauges into Slack alerts through the existing Netdata
  notification pipeline. Install it with:
  `cp hosts/mac-mini/netdata/health.d/media_automation.conf /opt/homebrew/etc/netdata/health.d/`
  and restart netdata.

## SilverBullet on the Mac mini

SilverBullet (ADR 014) runs on the hub as the human-facing notes application.
It shares a private Git-backed Markdown space at `~/knowledge` with Basic
Memory. A launchd agent keeps it running across reboots and crashes.

SilverBullet uses host port **3001** because AdGuard Home occupies port 3000
on the Mac mini. AdGuard's macOS network extension intercepts browser HTTPS
traffic before Docker's port mapping can reach it.

### SilverBullet one-time bootstrap

Run on the hub with mise installed, Homebrew available, and colima running
(set up by the Jellyfin bootstrap):

```bash
mise run //homelab:sb-bootstrap
```

The bootstrap will:

1. Create a `.env` from the example template if one does not exist.
2. Initialise a private Git repository at `~/knowledge` if one does not exist.
3. Install and start a launchd agent.
4. Bring up the Docker Compose stack.

Edit `SB_USER` in the `.env` file before the second run:

```bash
printf 'SB_USER=%s:%s\n' "$(whoami)" "$(openssl rand -base64 18)" >> hosts/mac-mini/silverbullet/.env
```

### SilverBullet Tailscale Serve

After bootstrap, Tailscale Serve is managed automatically by a launchd agent
(`homelab.tailscale-serve`). It verifies every 5 minutes that port 3001 is
served and re-applies if overwritten by another Tailscale serve/funnel
invocation (e.g. t3-code preview agents).

```bash
# Check current status
tailscale serve status

# Manually re-apply if needed
tailscale serve --bg 3001
```

This provides HTTPS access at `https://<machine-name>.ts.net/` from any
device on the tailnet. Do not use Funnel or expose the port to the LAN.

### SilverBullet day-to-day

```bash
mise run //homelab:sb-status
mise run //homelab:sb-logs
mise run //homelab:sb-restart
mise run //homelab:sb-verify
```

### SilverBullet upgrading

1. Bump `SB_VERSION` in `.env` (or leave as `:latest`).
2. `mise run //homelab:sb-pull`

### SilverBullet caveats

- **Port 3000 is unavailable.** AdGuard Home natively occupies port 3000
  with a macOS network extension that intercepts browser traffic. Use
  port 3001 (or any other free port) for SilverBullet.
- **Shell backend is disabled.** The ADR disables `SB_SHELL_BACKEND` because
  t3-code agents already provide the automation layer. If you need shell
  commands from within SilverBullet, change `SB_SHELL_BACKEND` in the
  compose file, but review the security implications first.
- **Authentication is enabled** as defence in depth. The `SB_USER`
  credentials are required for browser and API access.
- **SilverBullet listens on localhost only.** The Docker compose file binds
  `127.0.0.1`. Remote access goes through Tailscale Serve, not direct
  port exposure.
- **SilverBullet health is watched too.** The media-automation keep-running
  agent reports the SilverBullet container's Docker health as a Netdata gauge,
  and the shared
  [`media_automation.conf`](hosts/mac-mini/netdata/health.d/media_automation.conf)
  alarm file raises a Slack alert if it stays unhealthy or exits.

## Basic Memory on the Mac mini

Basic Memory (ADR 014) is the agent-facing knowledge engine. It runs as a
host-level Python CLI, no Docker, no launchd agent. The MCP server is
launched on demand by each t3-code agent.

### Basic Memory one-time bootstrap

```bash
mise run //homelab:bm-bootstrap
```

This installs `uv`, the `basic-memory` CLI, and registers `~/knowledge`
as the default project.

### Basic Memory day-to-day

```bash
mise run //homelab:bm-status      # sync status between files and index
mise run //homelab:bm-reset       # rebuild index from Markdown files
```

### Connecting agents

After bootstrap, connect each t3-code agent to the MCP server:

**Claude Code:**

```bash
claude mcp add basic-memory -- bm mcp --project knowledge
```

**Codex** (add to `~/.codex/config.toml`):

```toml
[mcp_servers.basic-memory]
command = "bm"
args = ["mcp", "--project", "knowledge"]
```

**opencode** (add to `~/.config/opencode/config.json`):

```json
{
  "mcp": {
    "basic-memory": {
      "command": "bm",
      "args": ["mcp", "--project", "knowledge"]
    }
  }
}
```

### Basic Memory caveats

- **No persistent daemon.** The MCP server launches on demand; there is
  nothing to monitor or restart.
- **SQLite index is disposable.** Run `bm reset` to rebuild from files.
  The database lives at `~/.basic-memory/` outside the Git repository.
- **Shared space with SilverBullet.** Both tools index the same
  `~/knowledge` Markdown files. Changes through either interface are
  visible to the other after the file watcher syncs.
- **Manual reindex needed for CLI use.** The file watcher only runs when
  the MCP server is active. For `bm tool search-notes` from the terminal,
  run `bm reindex` after adding or editing notes outside of MCP. Use
  `bm reset` only to rebuild from scratch (drops and recreates all tables).
