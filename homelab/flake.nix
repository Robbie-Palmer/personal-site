{
  description = "Home lab machines declared as code";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs =
    { self, nixpkgs }:
    {
      nixosConfigurations.asus-desktop = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [ ./hosts/asus-desktop ];
      };
    };
}
