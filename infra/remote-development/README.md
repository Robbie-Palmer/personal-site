# Remote development infrastructure

This independently stateful Terraform root provisions the Hetzner Cloud
resources proposed by
[ADR 025](../../ui/content/projects/homelab/adrs/025-cloud-remote-development-plane.mdx).
It does not configure the operating system or deploy workloads.

## Ownership boundary

| Concern | Owner |
| --- | --- |
| Server, firewall, SSH public key, and persistent volume | This Terraform root |
| Operating system, mounts, Tailscale, and K3s | `homelab/` NixOS flake |
| t3-code and coding-agent workloads | K3s manifests |
| Provider and workload credentials | Doppler |

The remote K3s server is a separate cluster. Never join it to the home K3s
control plane.

## External prerequisites

Create these before the first plan:

1. A Hetzner Cloud project and read/write API token.
2. Terraform Cloud workspace `personal-site-remote-development` in the
   `robbie-palmer` organisation, configured for local execution.
3. Doppler project/config `homelab/prd_remote_development_infra` containing
   `HCLOUD_TOKEN` and `TF_API_TOKEN`.
4. GitHub environments `production-remote-development-infra-plan` and
   `production-remote-development-infra`. Put the same provider tokens in the
   plan environment can use a read-only Hetzner token; the protected apply
   environment needs a read/write token. Set `SSH_PUBLIC_KEY` as an environment
   variable in both.
5. Required reviewers on the apply environment.

`BOOTSTRAP_SSH_CIDRS` is a JSON list held as a GitHub environment variable,
for example `["203.0.113.10/32"]`. Leave it as `[]` during normal operation.
Temporarily add the operator's current public address only while installing or
recovering NixOS.

## Local use

Human-run commands obtain credentials through Doppler:

```bash
export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_ed25519.pub)"
export TF_VAR_bootstrap_ssh_cidrs='["203.0.113.10/32"]'
mise run //infra/remote-development:plan
```

Review `.planfile` before applying it. Application is deliberately separate:

```bash
mise run //infra/remote-development:apply
```

Do not apply a plan that replaces the server or deletes the persistent volume
unless that operation is the reviewed recovery objective. Delete and rebuild
protection default to enabled; disabling them requires a preceding apply.

## First installation

1. Plan and apply with one explicit bootstrap SSH CIDR.
2. Use the `nixos_anywhere_target` output to install the NixOS flake. Do not
   pass Tailscale, Doppler, or GitHub credentials through Terraform.
3. Supply a one-time tagged Tailscale key directly to the host bootstrap.
4. Reboot and verify the data mount, Tailscale, and K3s over the tailnet.
5. Set `bootstrap_ssh_cidrs` back to `[]`, plan, and apply the firewall change.

The public IP remains available for outbound connectivity and emergency
provider-console recovery, but the provider firewall exposes no SSH, t3-code,
or Kubernetes management port after commissioning.

## Persistence

The separately protected volume is formatted once as ext4 and attached without
provider automount. NixOS mounts the stable device exposed by the
`data_volume_linux_device` output. Increasing `data_volume_size_gb` is
supported; shrinking a Hetzner volume is not.

The volume survives ordinary server replacement, but it is not a backup.
Application-level encrypted backups and a tested restore remain required.
