# Ente photo export

The live job was inventoried on 2026-09-03 before Ansible took ownership.

| Setting | Observed value |
| --- | --- |
| launchd label | `com.robbie.ente-export` |
| Schedule | Daily at 03:00 local time |
| Wrapper | `~/.local/bin/ente-export.sh` |
| CLI | `/opt/homebrew/bin/ente`, version `cli-v0.2.3` |
| CLI installation | Official arm64 release binary, installed manually |
| CLI configuration | `~/.ente/ente-cli.db`, mode `0600` |
| Destination | `/Volumes/Expansion/Pictures/Ente Photos` |
| Destination disk | 10 TB ExFAT volume named `Expansion` |
| Log | `~/Library/Logs/ente-export.log` |
| Original overlap guard | None |
| Original alert | None found |

The original 14-line wrapper checked that the destination directory existed,
called `ente export`, and printed the exit status. It did not propagate that
status because its final `echo` returned zero. Ente CLI also returned zero on
2026-08-26 after logging repeated DNS and collection-fetch errors. launchd
therefore recorded a successful run even though the export failed.

The `ente_export` Ansible role replaces that wrapper. It checks the destination
volume UUID, serializes runs with `shlock`, treats either a nonzero exit or
error text as failure, and updates timestamp markers. A second launchd job
sends the mount, freshness, and last-run state to Netdata every minute. The
Netdata rules use the existing `sysadmin` notification route.

Preview the change before applying it:

```bash
mise run //homelab:ansible-check-mac
mise run //homelab:ansible-configure-mac
```

The apply reloads both launchd jobs but does not start a photo export. The next
scheduled run creates the first success marker.
