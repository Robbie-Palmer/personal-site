{
  disko.devices.disk.root = {
    type = "disk";
    # Kernel enumeration changes when nixos-anywhere boots its kexec image.
    # Hetzner exposes the server disk at LUN 0 and attached volumes at later
    # LUNs, so use the stable SCSI path instead of /dev/sdX.
    device = "/dev/disk/by-path/pci-0000:06:00.0-scsi-0:0:0:0";
    content = {
      type = "gpt";
      partitions = {
        bios = {
          size = "1M";
          type = "EF02";
        };
        root = {
          size = "100%";
          content = {
            type = "filesystem";
            format = "ext4";
            mountpoint = "/";
            mountOptions = [ "noatime" ];
          };
        };
      };
    };
  };
}
