{
  config,
  pkgs,
  ...
}:

let
  dataDevice = "/dev/disk/by-id/scsi-0HC_Volume_106792547";
  dataMapper = "remote-development-data";
  dataMount = "/srv/remote-development";
  dataKeyFile = "/var/lib/remote-development-secrets/data-volume.key";
  pilotDataPath = "${dataMount}/t3-code-pilot";
  pilotProjectId = "2001";
  pilotBlockHardLimit = "10G";
  pilotBlockHardLimitKiB = "10485760";
  pilotInodeHardLimit = "1000000";
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

  environment.etc = {
    crypttab.text = ''
      ${dataMapper} ${dataDevice} ${dataKeyFile} luks,nofail
    '';
    projects.text = ''
      ${pilotProjectId}:${pilotDataPath}
    '';
    projid.text = ''
      t3-code-pilot:${pilotProjectId}
    '';
  };

  fileSystems.${dataMount} = {
    device = "/dev/mapper/${dataMapper}";
    fsType = "ext4";
    options = [
      "nofail"
      "noatime"
      "prjquota"
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
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/home
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/home/.t3
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/home/.codex
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/home/.codex-personal
      install -d -m 0700 -o t3code -g t3code ${pilotDataPath}/workspaces
    '';
  };

  systemd.services.remote-development-project-quotas = {
    description = "Apply remote-development project quotas";
    after = [ "remote-development-data-layout.service" ];
    requires = [ "remote-development-data-layout.service" ];
    before = [ "k3s.service" ];
    wantedBy = [ "multi-user.target" ];
    path = [
      pkgs.e2fsprogs
      pkgs.quota
      pkgs.util-linux
    ];
    serviceConfig = {
      Type = "oneshot";
      RemainAfterExit = true;
    };
    script = ''
      test "$(findmnt --noheadings --output FSTYPE --target ${dataMount})" = ext4
      findmnt --noheadings --output OPTIONS --target ${dataMount} \
        | tr ',' '\n' \
        | grep -Fx prjquota >/dev/null

      if ! quotaon --project --print-state ${dataMount} | grep -F ' is on' >/dev/null; then
        quotaon --project ${dataMount}
      fi

      chattr -R -p ${pilotProjectId} ${pilotDataPath}
      chattr +P ${pilotDataPath}
      setquota --project ${pilotProjectId} 0 ${pilotBlockHardLimit} 0 ${pilotInodeHardLimit} ${dataMount}

      test "$(lsattr -dp ${pilotDataPath} | awk '{ print $1 }')" = ${pilotProjectId}
      lsattr -d ${pilotDataPath} | awk '{ print $1 }' | grep -F P >/dev/null
      repquota --project --verbose --no-names --output=csv ${dataMount} \
        | awk -F, '$1 == "#${pilotProjectId}" {
            found = 1
            if ($6 != "${pilotBlockHardLimitKiB}" || $10 != "${pilotInodeHardLimit}") exit 1
          }
          END { if (!found) exit 1 }'
    '';
  };

  systemd.services.k3s = {
    after = [
      "srv-remote\\x2ddevelopment.mount"
      "remote-development-data-layout.service"
      "remote-development-project-quotas.service"
    ];
    requires = [
      "srv-remote\\x2ddevelopment.mount"
      "remote-development-data-layout.service"
      "remote-development-project-quotas.service"
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
        tailscale serve --bg --https=8443 http://127.0.0.1:30774
        tailscale serve --bg --https=3000 http://127.0.0.1:31000
        tailscale serve --bg --https=3001 http://127.0.0.1:31001
        tailscale serve --bg --https=3002 http://127.0.0.1:31002
        tailscale serve --bg --https=3003 http://127.0.0.1:31003
        tailscale serve --bg --https=3004 http://127.0.0.1:31004
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
    e2fsprogs
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
    quota
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
