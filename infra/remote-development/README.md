# Remote development infrastructure

This directory is reserved for the independently stateful Terraform root that
will provision the remote coding-agent environment. It intentionally contains
no Terraform configuration until the provider, host design, persistence model,
and bootstrap boundary are accepted.

The future root is expected to own cloud resources such as the VPS, provider
firewall, and persistent storage. NixOS will own host configuration, K3s will
own containerised workloads, and Doppler will remain the secret source of
truth. The remote cluster must not join the home K3s control plane.
