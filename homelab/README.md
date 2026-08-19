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

### One-time bootstrap

Run on the hub with mise installed and Homebrew available:

```bash
mise run //homelab:bootstrap
```

The bootstrap will prompt you to create a `.env` file from the example
template and set `MEDIA_DIR` to your library on the 10TB HDD, then re-run.

Once complete it prints access URLs:

- **Local**: `http://localhost:8096`
- **LAN** (Fire TV Stick): `http://<hub-lan-ip>:8096`
- **Tailnet** (phone / laptop): `http://<hub-tailscale-ip>:8096`

Then add your media folders in the Jellyfin web UI: TV shows under
`/media/TV` and movies under `/media/Movies`.

### Day-to-day

```bash
mise run //homelab:status
mise run //homelab:logs
mise run //homelab:restart
mise run //homelab:verify
```

### Upgrading

1. Bump `JELLYFIN_VERSION` in `.env` (or pin an exact release).
2. `mise run //homelab:pull`

### Caveats

- **Brief unauthenticated window on first bootstrap.** Between the stack
  starting and provisioning completing, Jellyfin's startup wizard is
  accessible on the port. The router forwards no ports and the tailnet is
  the lab's trust boundary, so this is only a risk if an untrusted peer is
  on the LAN during the few seconds bootstrap runs.
- **The drive must be mounted before bootstrap.** If the HDD isn't
  connected or auto-mounted at login, the mount point won't exist.
- The [Netdata](/projects/homelab/adrs/009-netdata) alerting on the hub
  should gain a check for the Jellyfin container and the media drive, so a
  dead stack is noticed before the family does.
