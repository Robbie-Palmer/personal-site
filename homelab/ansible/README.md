# Ansible migration bridge

This directory implements the first stage of
[ADR 022](../../ui/content/projects/homelab/adrs/022-ansible-k3s-migration-bridge.mdx).
It inventories the three live hosts, gathers facts, and checks fleet health.
It does not configure workloads.

Ansible Core is pinned in `homelab/mise.toml`. Run every command through mise
from the repository root:

```bash
mise run //homelab:ansible-inventory
mise run //homelab:ansible-syntax
mise run //homelab:ansible-lint
mise run //homelab:ansible-test
mise run //homelab:ansible-facts
mise run //homelab:ansible-discover-pi
mise run //homelab:ansible-verify
mise run //homelab:ansible-check-mac
mise run //homelab:ansible-configure-mac
```

The facts and verification playbooks only read remote state. They connect to
one host at a time. Ansible runs locally on the Mac mini. The two Linux hosts
use SSH through their MagicDNS names. Test Tailscale SSH before the first
Ansible run:

```bash
tailscale ssh pi@raspberrypi.tailaa0e46.ts.net true
tailscale ssh robbie@asus-desktop.tailaa0e46.ts.net true
```

The inventory keeps normal SSH host-key checking enabled. Accept each Linux
host key with a direct `ssh` connection after the Tailscale SSH test confirms
the node identity. Do not disable host-key checking to skip this step.

The Pi discovery command prints its operating system, SD-card and boot mounts,
relevant package versions, matching systemd units, and CUPS queues. It does not
read service configuration files, which may contain credentials.
The dated findings live in
[`hosts/raspberry-pi/README.md`](../hosts/raspberry-pi/README.md).

`ansible-check-mac` previews the permanent Mac host changes. The apply command
installs the pinned Ente CLI, wrapper, launchd jobs, and Netdata alarms. It
does not start an export. The daily job retains its 03:00 schedule.

The role uses the live system inspected on 2026-09-03. The CLI credentials stay
in `~/.ente/ente-cli.db`, mode `0600`, and never enter Ansible output. The
wrapper verifies the 10 TB volume by UUID before calling `ente export`. It uses
an atomic process lock, caps each run at 30 minutes, and writes non-secret
success and failure timestamps. The health job sends mount, freshness, and
last-run gauges to Netdata once per minute.

The verification playbook reads marker metadata only. Normal and verbose
Ansible output does not print the launchd job, mount table, or marker path.
