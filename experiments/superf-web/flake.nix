{
  description = "Pinned SuperF author web bundle: bounded type-inference probes";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: let
    pkgs = nixpkgs.legacyPackages.x86_64-linux;
    bundle = pkgs.fetchurl {
      url = "https://raw.githubusercontent.com/hkust-taco/superf/be9ece0d75d11e576f8c15a4f345900626d9138e/bin/mlscript-opt.js";
      sha256 = "37f3c2a1e57877877e45775dc8fc879b4a8a45d1ef2de667980e39a4ab0c1d24";
    };
    check = pkgs.writeShellApplication {
      name = "check-superf-web";
      runtimeInputs = [ pkgs.nodejs_22 ];
      text = ''SUPERF_BUNDLE=${bundle} exec node ${./.}/check.mjs "$@"'';
    };
  in {
    apps.x86_64-linux.default = { type = "app"; program = "${check}/bin/check-superf-web"; };
    checks.x86_64-linux.probes = pkgs.runCommand "superf-web-probes" { nativeBuildInputs = [ pkgs.nodejs_22 ]; } ''
      SUPERF_BUNDLE=${bundle} node ${./.}/check.mjs > $out
    '';
    devShells.x86_64-linux.default = pkgs.mkShell {
      packages = [ pkgs.nodejs_22 ];
      SUPERF_BUNDLE = bundle;
    };
  };
}
