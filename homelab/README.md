# homelab

Declarative [NixOS](https://nixos.org) configurations for my home lab, managed
with flakes. The config is a git repo, so every change is reviewable and
rollbackable — the same config in produces the same system out.

## Hosts

| host         | hardware                     | role                                      |
| ------------ | ---------------------------- | ----------------------------------------- |
| asus-desktop | GTX 1060, 111G SSD + 1T HDD  | wake-on-demand GPU worker for CV batches  |

### asus-desktop

A headless, wake-on-demand GPU worker. Models run in Docker with CUDA 12.x
images (`--gpus all`); the host stays lean. It sleeps when idle and is woken
on demand over the tailnet (Wake-on-LAN from the Mac Mini).

Why the stack is pinned:

- GTX 10-series (Pascal, `sm_61`) is legacy — CUDA 13 and the 585+ driver
  branches dropped support for it.
- The config pins an LTS kernel plus the 580 driver branch (the last with
  Pascal support) on nixos-25.11, and then stays there. That lock is the whole
  point of declaring it: no surprise upgrade can break the GPU.

## Install

Requirements: NixOS minimal ISO on a USB stick, an ethernet connection, and
console access to the machine.

1. **Boot the installer** (minimal ISO lands in a root TTY).

2. **Wipe and partition the disks.** Both disks below were backed up already.
   `sda` is the system disk; `sdb` is reused as a data disk for models and
   datasets (Docker stays on the SSD, which is only 111G).

   ```bash
   # system disk
   parted /dev/sda -- mklabel msdos
   parted /dev/sda -- mkpart ext4 1MiB 100%
   mkfs.ext4 -L nixos /dev/sda1
   mount /dev/sda1 /mnt

   # data disk
   parted /dev/sdb -- mklabel gpt
   parted /dev/sdb -- mkpart ext4 1MiB 100%
   mkfs.ext4 -L data /dev/sdb1
   mkdir -p /mnt/srv
   mount /dev/sdb1 /mnt/srv
   ```

3. **Generate the machine-specific hardware config and pull the flake.**

   ```bash
   nixos-generate-config --root /mnt
   git clone --depth 1 --branch homelab/gpu-worker \
     https://github.com/Robbie-Palmer/personal-site.git /mnt/etc/nixos/homelab
   cp /mnt/etc/nixos/hardware-configuration.nix \
     /mnt/etc/nixos/homelab/hosts/asus-desktop/
   ```

   `hardware-configuration.nix` is generated per machine, so it is not
   committed; the flake imports it only when present.

4. **(Recommended) sanity-check the NVIDIA pin before installing.**

   ```bash
   nix eval --raw /mnt/etc/nixos/homelab#nixosConfigurations.asus-desktop.config.boot.kernelPackages.nvidiaPackages.stable.version
   ```

   Must be a `580.x` (the last driver branch supporting Pascal). If it has
   drifted past 580, pin the last 580 build via `nvidiaPackages.mkDriver`
   before installing.

5. **Install.**

   ```bash
   cd /mnt/etc/nixos/homelab
   nixos-install --flake .#asus-desktop
   ```

   Set the root password when prompted. Expect ~10-30 min of downloads and
   building.

6. **Reboot**, eject the USB, log in as `root` at the local console, then give
   your user a password so `sudo` works:

   ```bash
   passwd robbie
   ```

   No password is committed to this repo.

7. **Verify and join the tailnet.**

   ```bash
   nvidia-smi                                     # GTX 1060, driver 580.x
   sudo tailscale up                              # joins tailnet as asus-desktop
   docker run --rm --gpus all nvidia/cuda:12.4.1-devel-ubuntu22.04 nvidia-smi
   ```

   The docker line proves driver + container toolkit + CUDA 12 all work
   together. After this, the Mac can reach the box via `ssh robbie@asus-desktop`.

8. **In the BIOS**, enable Wake-on-LAN (power-on by PCI-E).

## Managing

Rebuild after any change to this repo:

```bash
sudo nixos-rebuild switch --flake /etc/nixos/homelab#asus-desktop
```

Keep the box on the pinned channel — the lock is what keeps Pascal alive.

## Notes

- Models run as CUDA 12.x containers only (CUDA 13 dropped Pascal/`sm_61`).
- `hardware-configuration.nix` is machine-generated; don't reuse it across
  hosts.
