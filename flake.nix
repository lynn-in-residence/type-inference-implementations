{
  description = "Published teaching type inferencers, bounded rule experiments and pinned author adapters";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    command = name: script: pkgs.writeShellApplication {
      inherit name;
      runtimeInputs = [ pkgs.nodejs_22 ];
      text = ''exec node ${./.}/${script} "$@"'';
    };
    check = command "check-type-experiments" "run-checks.mjs";
    wj = command "type-w-j" "scripts/w-j.mjs";
    constraints = command "type-constraints" "scripts/constraints.mjs";
    bidirectional = command "type-bidirectional" "scripts/bidirectional.mjs";
    app = package: name: { type = "app"; program = "${package}/bin/${name}"; };
  in {
    apps.${system} = {
      default = app check "check-type-experiments";
      w-j = app wj "type-w-j";
      constraints = app constraints "type-constraints";
      bidirectional = app bidirectional "type-bidirectional";
    };
    packages.${system}.default = check;
    checks.${system}.standalone = pkgs.runCommand "published-type-experiments" { nativeBuildInputs = [ pkgs.nodejs_22 ]; } ''
      node ${./.}/publication/check-hashes.mjs
      node ${./.}/run-checks.mjs > $out
    '';
    devShells.${system}.default = pkgs.mkShell { packages = [ pkgs.nodejs_22 ]; };
  };
}
