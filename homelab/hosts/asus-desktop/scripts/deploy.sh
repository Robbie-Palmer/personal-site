#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
host="${1:-robbie@asus-desktop.tailaa0e46.ts.net}"

repo="$(git -C "$repo_root" config --get remote.origin.url | sed -e 's#^git@github.com:##' -e 's#\.git$##')"
sha="$(git -C "$repo_root" rev-parse HEAD)"

ssh -o BatchMode=yes "$host" "sudo nixos-rebuild switch --flake 'github:${repo}/${sha}?dir=homelab#asus-desktop'"
