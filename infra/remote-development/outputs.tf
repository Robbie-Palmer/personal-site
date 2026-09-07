output "server_id" {
  description = "Hetzner Cloud server ID"
  value       = hcloud_server.remote_development.id
}

output "server_ipv4_address" {
  description = "Public IPv4 address used for controlled bootstrap and outbound connectivity"
  value       = hcloud_server.remote_development.ipv4_address
}

output "server_ipv6_address" {
  description = "First public IPv6 address assigned to the server"
  value       = hcloud_server.remote_development.ipv6_address
}

output "nixos_anywhere_target" {
  description = "Temporary SSH target for nixos-anywhere while bootstrap ingress is enabled"
  value       = "root@${hcloud_server.remote_development.ipv4_address}"
}

output "data_volume_id" {
  description = "Persistent workspace volume ID"
  value       = hcloud_volume.workspace.id
}

output "data_volume_linux_device" {
  description = "Stable device path that the NixOS host mounts as workspace storage"
  value       = hcloud_volume.workspace.linux_device
}
