{
  config,
  lib,
  pkgs,
  ...
}:

let
  dataDevice = "/dev/disk/by-id/scsi-0HC_Volume_106792547";
  dataMapper = "remote-development-data";
  dataMount = "/srv/remote-development";
  dataKeyFile = "/var/lib/remote-development-secrets/data-volume.key";
  operatorKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIj4+tNshoonWcOZFnSV0YcXgKuGqfcmn5HyIvLCfdQe robbiepalmer@live.co.uk";
in
{
  imports = [
    ./disk-config.nix
    ./hardware-configuration.nix
  ];

  assertions = [
    {
      assertion = dataDevice != "/dev/sda";
      message = "The persistent data volume must not be the disko-managed root disk.";
    }
  ];

  networking = {
    hostName = "remote-development";
    firewall = {
      enable = true;
      checkReversePath = "loose";
      allowedUDPPorts = [ config.services.tailscale.port ];
      trustedInterfaces = [ "tailscale0" ];
    };
  };

  boot = {
    loader.grub = {
      enable = true;
      configurationLimit = 10;
    };
    tmp.cleanOnBoot = true;
  };

  environment.etc.crypttab.text = ''
    ${dataMapper} ${dataDevice} ${dataKeyFile} luks,nofail
  '';

  fileSystems.${dataMount} = {
    device = "/dev/mapper/${dataMapper}";
    fsType = "ext4";
    options = [
      "nofail"
      "noatime"
      "x-systemd.device-timeout=30s"
    ];
  };

  systemd.tmpfiles.rules = [
    "d /var/lib/remote-development-secrets 0700 root root -"
  ];

  users = {
    mutableUsers = false;
    groups.t3code.gid = 2000;
    users = {
      root.openssh.authorizedKeys.keys = [ operatorKey ];
      robbie = {
        isNormalUser = true;
        uid = 1000;
        extraGroups = [ "wheel" ];
        openssh.authorizedKeys.keys = [ operatorKey ];
      };
      t3code = {
        isSystemUser = true;
        uid = 2000;
        group = "t3code";
        home = "${dataMount}/t3-code/home";
        createHome = false;
      };
    };
  };

  security.sudo.wheelNeedsPassword = false;

  services = {
    openssh = {
      enable = true;
      openFirewall = true;
      settings = {
        AllowUsers = [
          "root"
          "robbie"
        ];
        KbdInteractiveAuthentication = false;
        PasswordAuthentication = false;
        PermitRootLogin = "prohibit-password";
        X11Forwarding = false;
      };
    };

    tailscale = {
      enable = true;
      extraSetFlags = [ "--ssh" ];
    };

    k3s = {
      enable = true;
      role = "server";
      nodeName = "remote-development";
      nodeLabel = [
        "homelab.dev/location=cloud"
        "homelab.dev/capability=agent-workspace"
        "homelab.dev/power-profile=always-on"
      ];
      disable = [
        "servicelb"
        "traefik"
      ];
      extraFlags = [
        "--data-dir=${dataMount}/k3s"
        "--secrets-encryption"
        "--write-kubeconfig-mode=0640"
      ];
      gracefulNodeShutdown.enable = true;
      extraKubeletConfig = {
        containerLogMaxFiles = 3;
        containerLogMaxSize = "20Mi";
      };
    };

    journald.extraConfig = ''
      SystemMaxUse=1G
      RuntimeMaxUse=256M
      MaxRetentionSec=14day
      Compress=yes
    '';
  };

  systemd.services.remote-development-data-layout = {
    description = "Create persistent remote-development data directories";
    after = [ "srv-remote\\x2ddevelopment.mount" ];
    requires = [ "srv-remote\\x2ddevelopment.mount" ];
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
    };
    script = ''
      install -d -m 0700 -o root -g root ${dataMount}/k3s
      install -d -m 0750 -o t3code -g t3code ${dataMount}/t3-code
      install -d -m 0750 -o t3code -g t3code ${dataMount}/t3-code/home
      install -d -m 0700 -o t3code -g t3code ${dataMount}/t3-code/home/.t3
      install -d -m 0700 -o t3code -g t3code ${dataMount}/t3-code/home/.codex
      install -d -m 0700 -o t3code -g t3code ${dataMount}/t3-code/home/.codex-personal
      install -d -m 0750 -o t3code -g t3code ${dataMount}/t3-code/workspaces
    '';
  };

  systemd.services.k3s = {
    after = [
      "srv-remote\\x2ddevelopment.mount"
      "remote-development-data-layout.service"
    ];
    requires = [
      "srv-remote\\x2ddevelopment.mount"
      "remote-development-data-layout.service"
    ];
  };

  systemd.services.t3-code-tailscale-serve = {
    description = "Publish t3-code to the tailnet with Tailscale Serve";
    after = [
      "k3s.service"
      "tailscaled.service"
    ];
    wants = [
      "k3s.service"
      "tailscaled.service"
    ];
    wantedBy = [ "multi-user.target" ];
    path = [
      pkgs.jq
      pkgs.tailscale
    ];
    script = ''
      if tailscale status --json | jq --exit-status '.BackendState == "Running"' >/dev/null; then
        tailscale serve --bg --https=443 http://127.0.0.1:30773
      else
        echo "Tailscale is not enrolled; Serve will be configured after enrollment"
      fi
    '';
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
      Restart = "on-failure";
      RestartSec = "30s";
    };
  };

  environment.systemPackages = with pkgs; [
    bind
    cryptsetup
    curl
    git
    gh
    htop
    jq
    k3s
    kubectl
    kubernetes-helm
    kustomize
    less
    lsof
    mtr
    neovim
    ripgrep
    rsync
    tmux
    tree
  ];

  nix = {
    settings = {
      experimental-features = [
        "nix-command"
        "flakes"
      ];
      auto-optimise-store = true;
    };
    gc = {
      automatic = true;
      dates = "Sun 04:15";
      options = "--delete-older-than 30d";
    };
  };

  system.autoUpgrade.enable = false;
  time.timeZone = "Europe/London";
  system.stateVersion = "25.11";
}
