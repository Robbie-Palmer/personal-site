# Home Lab (code-as-config)

This directory declares the home lab's machines as code, following the layout
planned in [ADR 010](/projects/homelab/adrs/010-nixos-gpu-worker). The goal is
the same one that motivates the whole lab — the same config in produces the
same system out, every change is reviewable and rollbackable, and nothing is
hand-edited on a box that then forgets it.

All services are reachable only over the home LAN and the
[Tailscale](/projects/homelab/adrs/000-tailscale) tailnet — the router
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
- The [Netdata](/projects/homelab/adrs/009-netdata) alerting on the hub
  should gain a check for the Jellyfin container and the media drive, so a
  dead stack is noticed before the family does.

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
  compose file — but review the security implications first.
- **Authentication is enabled** as defence in depth. The `SB_USER`
  credentials are required for browser and API access.
- **SilverBullet listens on localhost only.** The Docker compose file binds
  `127.0.0.1`. Remote access goes through Tailscale Serve, not direct
  port exposure.
- The [Netdata](/projects/homelab/adrs/009-netdata) alerting should also
  check the SilverBullet container health.

## Basic Memory on the Mac mini

Basic Memory (ADR 014) is the agent-facing knowledge engine. It runs as a
host-level Python CLI — no Docker, no launchd agent. The MCP server is
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
  run `bm reindex` after adding or editing notes outside of MCP.
