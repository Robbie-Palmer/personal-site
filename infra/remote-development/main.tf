locals {
  common_labels = merge(
    {
      environment = "production"
      managed-by  = "terraform"
      role        = "remote-development"
    },
    var.labels,
  )
}

resource "hcloud_ssh_key" "bootstrap" {
  name       = "${var.server_name}-bootstrap"
  public_key = trimspace(var.ssh_public_key)
  labels     = local.common_labels
}

resource "hcloud_firewall" "remote_development" {
  name   = var.server_name
  labels = local.common_labels

  dynamic "rule" {
    for_each = length(var.bootstrap_ssh_cidrs) == 0 ? [] : [var.bootstrap_ssh_cidrs]

    content {
      direction   = "in"
      protocol    = "tcp"
      port        = "22"
      source_ips  = sort(tolist(rule.value))
      description = "Temporary NixOS bootstrap access"
    }
  }

  rule {
    direction   = "in"
    protocol    = "udp"
    port        = "41641"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "Tailscale direct WireGuard transport"
  }

  rule {
    direction   = "in"
    protocol    = "icmp"
    source_ips  = ["0.0.0.0/0", "::/0"]
    description = "Path MTU discovery and network diagnostics"
  }
}

resource "hcloud_server" "remote_development" {
  name        = var.server_name
  image       = var.bootstrap_image
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.bootstrap.id]
  firewall_ids = [
    hcloud_firewall.remote_development.id,
  ]
  backups                  = var.enable_backups
  delete_protection        = var.enable_delete_protection
  rebuild_protection       = var.enable_delete_protection
  shutdown_before_deletion = true
  labels                   = local.common_labels

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  lifecycle {
    # nixos-anywhere replaces the bootstrap image in place. SSH key changes are
    # handled through the declared NixOS user after first installation; neither
    # value should replace a working development host.
    ignore_changes = [image, ssh_keys]
  }
}

resource "hcloud_volume" "workspace" {
  name              = "${var.server_name}-workspace"
  location          = var.location
  size              = var.data_volume_size_gb
  format            = "ext4"
  delete_protection = var.enable_delete_protection
  labels            = local.common_labels
}

resource "hcloud_volume_attachment" "workspace" {
  volume_id = hcloud_volume.workspace.id
  server_id = hcloud_server.remote_development.id
  automount = false
}
