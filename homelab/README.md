# Home Lab (code-as-config)

This directory declares the home lab's machines as code, following the layout
planned in [ADR 010](/projects/homelab/adrs/010-nixos-gpu-worker): every host
gets a `homelab/hosts/<host>/` directory, and each service on that host is a
subdirectory of it. The goal is the same one that motivates the whole lab —
the same config in produces the same system out, every change is reviewable
and rollbackable, and nothing is hand-edited on a box that then forgets it.

```text
homelab/
├── mise.toml                 # tasks: bootstrap, up, down, status, logs, pull, verify
├── hosts/
│   ├── mac-mini/             # the home hub
│   │   └── jellyfin/         # Jellyfin media server (ADR 011)
│   │       ├── docker-compose.yml
│   │       ├── .env.example  # copy to .env and set MEDIA_DIR (gitignored)
│   │       ├── launchd/      # homelab.jellyfin.plist template
│   │       └── scripts/      # bootstrap.sh, keep-running.sh
│   └── asus-desktop/         # future: NixOS flake for the GPU worker (ADR 010)
```

All services are reachable only over the home LAN and the
[Tailscale](/projects/homelab/adrs/000-tailscale) tailnet — the router
forwards no ports, so nothing is ever public.

## Jellyfin on the Mac mini

Jellyfin (ADR 011) runs on the hub in Docker Compose, managed by colima. The
stack is declared in `hosts/mac-mini/jellyfin/`; a launchd agent keeps colima
and the stack running across reboots and crashes.

### One-time bootstrap

Run on the hub with mise installed and Homebrew available:

```bash
cp hosts/mac-mini/jellyfin/.env.example hosts/mac-mini/jellyfin/.env
# edit .env: set MEDIA_DIR to your library on the 10TB HDD
mise run //homelab:bootstrap
```

`bootstrap.sh` installs colima, docker, and docker-compose via Homebrew,
starts colima with `/Volumes` mounted read-only (vz + virtiofs), installs the
`homelab.jellyfin` LaunchAgent, and brings up the stack. It then prints the
access URLs:

- **Local**: `http://localhost:8096`
- **LAN** (Fire TV Stick): `http://<hub-lan-ip>:8096`
- **Tailnet** (phone / laptop): `http://<hub-tailscale-ip>:8096`

Then add your media folders in the Jellyfin web UI: TV shows under
`/media/TV` and movies under `/media/Movies` (the library is mounted
read-only as `/media`).

### Day-to-day

```bash
mise run //homelab:status    # docker compose ps
mise run //homelab:logs      # follow Jellyfin logs
mise run //homelab:restart   # restart the container
mise run //homelab:verify    # hit the health endpoint
```

### Upgrading

Jellyfin image tags are pinned in `.env` (`JELLYFIN_VERSION`, default `10.11`
for patch updates of the current stable minor). To upgrade:

1. Bump `JELLYFIN_VERSION` in `.env` (or pin an exact release).
2. `mise run //homelab:pull` — pulls the new image and recreates the
   container, keeping the existing config in `data/config/`.

### Caveats

- **Brief unauthenticated window on first bootstrap.** Between
  `docker compose up` and `provision.sh` completing, Jellyfin's startup
  wizard is accessible on the port. The router forwards no ports and the
  tailnet is the lab's trust boundary, so this is only a risk if an
  untrusted peer is on the LAN during the few seconds bootstrap runs.
- **colima mounts only `$HOME` by default.** The bootstrap mounts `/Volumes`
  read-only so the media drive is visible to containers. If you start colima
  manually without those flags, Jellyfin will see an empty `/media`. If the
  drive isn't visible, recreate colima: `colima delete` then re-run
  `mise run //homelab:bootstrap`.
- **Drive names with spaces break colima mounts.** Name the media volume
  without spaces (e.g. `HOME-LAB-10TB`), or the mount fails at colima start.
- **The drive must be mounted before colima starts.** If the HDD isn't
  connected or auto-mounted at login, the mount point won't exist.
- **Config lives in `data/config/`** (gitignored) next to the compose file,
  so Jellyfin's metadata and settings are plain files on the hub's disk that
  a backup job can copy. Move it by setting `JELLYFIN_CONFIG_DIR` if the
  library metadata grows large.
- The [Netdata](/projects/homelab/adrs/009-netdata) alerting on the hub
  should gain a check for the Jellyfin container and the media drive, so a
  dead stack is noticed before the family does.
