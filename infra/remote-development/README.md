# Remote development infrastructure

This independently stateful Terraform root provisions the remote coding-agent
environment proposed by
[ADR 025](../../ui/content/projects/homelab/adrs/025-cloud-remote-development-plane.mdx).

This root owns only Hetzner Cloud resources: the VPS, provider firewall, SSH
public key registration, and persistent storage. NixOS owns host configuration,
K3s owns containerised workloads, and Doppler remains the secret source of
truth. The remote cluster must not join the home K3s control plane.

Its Terraform Cloud workspace is `personal-site-remote-development`. Plans and
applies must remain independent from both existing infrastructure roots.
