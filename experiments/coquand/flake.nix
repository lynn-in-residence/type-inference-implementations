{
  description = "Eight bounded probes of Coquand's unchanged author-linked conv1.hs";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    author = pkgs.fetchurl {
      url = "https://www.cse.chalmers.se/~coquand/conv1.hs";
      hash = "sha256-3K9T6zKW+SIDSlLX9a2oXITzasLObWWAo8Bk8fGjnnU=";
    };
    observed = pkgs.runCommand "coquand-conv1-probes" {
      nativeBuildInputs = [ pkgs.ghc pkgs.coreutils ];
    } ''
      printf 'import Control.Exception\n' > Combined.hs
      cat ${author} ${./Probe.hs} >> Combined.hs
      timeout 30 runghc Combined.hs > actual.tsv
      cmp actual.tsv ${./observed.tsv}
      cp actual.tsv $out
    '';
    show = pkgs.writeShellApplication {
      name = "coquand-conv1-probes";
      text = ''cat ${observed}'';
    };
  in {
    packages.${system}.default = observed;
    checks.${system}.observations = observed;
    apps.${system}.default = { type = "app"; program = "${show}/bin/coquand-conv1-probes"; };
    devShells.${system}.default = pkgs.mkShell { packages = [ pkgs.ghc ]; };
  };
}
