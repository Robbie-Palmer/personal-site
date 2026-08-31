{
  config,
  lib,
  pkgs,
  ...
}:

{
  imports = [ ./hardware-configuration.nix ];

  networking.hostName = "asus-desktop";

  nixpkgs.config = {
    allowUnfree = true;
    permittedInsecurePackages = [ "docker-28.5.2" ];
  };

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;
  boot.kernelPackages = pkgs.linuxPackages_6_12;

  services.xserver.videoDrivers = [ "nvidia" ];

  hardware.nvidia = {
    modesetting.enable = true;
    package = config.boot.kernelPackages.nvidiaPackages.stable;
    open = false;
    nvidiaSettings = false;
    nvidiaPersistenced = true;
  };

  hardware.nvidia-container-toolkit.enable = true;

  virtualisation.docker.enable = true;

  services.openssh.enable = true;
  services.tailscale.enable = true;

  networking.networkmanager.enable = true;
  networking.firewall.trustedInterfaces = [ "tailscale0" ];

  systemd.network.links."30-wake-on-lan" = {
    matchConfig.Type = "ether";
    linkConfig.WakeOnLan = "magic";
  };

  time.timeZone = "Europe/London";

  users.users.robbie = {
    isNormalUser = true;
    extraGroups = [ "wheel" "docker" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM10tppAS+3nlXzecNqk+YUuzwN2KtT5//gwoUqhDt36 robbiepalmer@live.co.uk"
    ];
  };

  environment.systemPackages = with pkgs; [ git ];

  system.stateVersion = "25.11";
}
