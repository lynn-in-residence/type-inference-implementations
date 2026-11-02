{
  description = "Pinned author implementation for Local Contextual Type Inference";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.lcti = {
    url = "github:juniorxxue/LCTI/c3c4634d1f2df5a69cab5fc6fa4cabb568000520";
    flake = false;
  };
  outputs = { self, nixpkgs, lcti }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      prototype = pkgs.haskell.lib.overrideCabal
        (pkgs.haskellPackages.callCabal2nix "Poly" "${lcti}/impl/Poly" {})
        (_: {
          # Upstream lists documentation files absent from its repository.
          # Remove only the broken packaging declarations; Haskell is unchanged.
          postPatch = ''
            sed -i '/^license-file:/d; /^extra-doc-files:/d' Poly.cabal
          '';
        });
      witness = pkgs.writeShellApplication {
        name = "check-lcti";
        runtimeInputs = [ pkgs.nodejs_22 ];
        text = ''
          export LOCALE_ARCHIVE=${pkgs.glibcLocales}/lib/locale/locale-archive
          export LC_ALL=en_US.UTF-8
          export LCTI_BIN=${prototype}/bin/Poly
          exec node ${./.}/check.mjs "$@"
        '';
      };
    in {
      packages.x86_64-linux.default = prototype;
      checks.x86_64-linux.witness = pkgs.runCommand "lcti-author-witness" {} ''
        ${witness}/bin/check-lcti --check > $out
        ${witness}/bin/check-lcti --trace > traces.txt
        cmp traces.txt ${./traces.txt}
        ${witness}/bin/check-lcti --tree known-before-lambda > tree.txt
        cmp tree.txt ${./twice-tree.txt}
      '';
      apps.x86_64-linux.check = { type = "app"; program = "${witness}/bin/check-lcti"; };
      apps.x86_64-linux.default = {
        type = "app";
        program = "${prototype}/bin/Poly";
      };
    };
}
