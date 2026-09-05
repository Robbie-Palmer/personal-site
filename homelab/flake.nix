{
  description = "Home lab machines declared as code";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    nixos-anywhere = {
      url = "github:nix-community/nixos-anywhere";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      disko,
      nixos-anywhere,
      nixpkgs,
    }:
    {
      packages.x86_64-linux.nixos-anywhere = nixos-anywhere.packages.x86_64-linux.default;

      nixosConfigurations.asus-desktop = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          ./hosts/asus-desktop
          {
            system.configurationRevision =
              if self ? rev then self.rev else self.dirtyRev or null;
          }
        ];
      };

      nixosConfigurations.remote-development = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          disko.nixosModules.disko
          ./hosts/remote-development
          {
            system.configurationRevision =
              if self ? rev then self.rev else self.dirtyRev or null;
          }
        ];
      };
    };
}
