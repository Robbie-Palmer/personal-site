# Raspberry Pi migration baseline

Captured on 3 September 2026 by
`mise run //homelab:ansible-discover-pi`. The command reads state and makes no
changes. Refresh this file before changing the Pi's operating system, storage,
DNS, printing, or monitoring setup.

## Host and storage

| Item | Discovered state |
| --- | --- |
| Operating system | Debian 13.6 |
| Kernel | `6.18.39+rpt-rpi-v8` |
| Architecture | AArch64 |
| Boot disk | 58.3 GB microSD, `/dev/mmcblk0` |
| Root | 57.8 GB ext4 on `/dev/mmcblk0p2`, mounted `rw,noatime` |
| Firmware | 512 MB vfat on `/dev/mmcblk0p1`, mounted at `/boot/firmware` |
| Swap | 2 GB zram active; an inactive 2 GB swap-formatted loop device exists |

The kernel command line is:

```text
console=serial0,115200 console=tty1 root=PARTUUID=3f4d648d-02 rootfstype=ext4 fsck.repair=yes rootwait cfg80211.ieee80211_regdom=GB
```

Active `/boot/firmware/config.txt` settings are:

```ini
dtparam=audio=on
camera_auto_detect=1
display_auto_detect=1
auto_initramfs=1
dtoverlay=vc4-kms-v3d
max_framebuffers=2
disable_fw_kms_setup=1
arm_64bit=1
disable_overscan=1
arm_boost=1
[cm4]
otg_mode=1
[cm5]
dtoverlay=dwc2,dr_mode=host
[pi5]
dtoverlay=nospi10
[all]
dtoverlay=gpio-fan,gpiopin=18,temp=55000
```

## Packages and services

| Package | Version |
| --- | --- |
| CUPS | `2.4.10-3+rpt2+deb13u2` |
| CUPS client | `2.4.10-3+rpt2+deb13u2` |
| Gutenprint | `5.3.4.20220624T01008808d602-4` |
| Netdata | `2.11.0.225.nightly` |
| Tailscale | `1.98.10` |

The enabled and running units are `AdGuardHome.service`,
`adguardhome-sync.service`, `cups.service`, `netdata.service`, and
`tailscaled.service`. `cups-browsed.service` is disabled and inactive.

The Pi is the secondary DNS resolver. AdGuardHome-Sync copies the primary
Mac resolver's settings to it. The fleet verifier sends an A query directly
to the Pi's local resolver at `127.0.0.1:53`; it does not rely on the resolver
listed in `/etc/resolv.conf`.

## Printing

CUPS has one enabled queue named `canon-mg3100`. Discovery found it idle and
connected over USB. The Pi has no default print destination.

The baseline records operational facts rather than raw AdGuard Home or CUPS
configuration files. Those files can contain password hashes, API details, or
device identifiers and do not belong in this repository.
