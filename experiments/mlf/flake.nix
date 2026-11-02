{
  description = "Source-pinned 2011 camlf gMLF/xMLF prototype";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4";
  inputs.legacy = {
    url = "github:NixOS/nixpkgs/1db42b7fe3878f3f5f7a4f2dc210772fd080e205";
    flake = false;
  };
  outputs = { self, nixpkgs, legacy }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      historical = import legacy { inherit system; };
      ocaml = historical.ocaml-ng.ocamlPackages_4_01_0;
      archive = pkgs.fetchurl {
        url = "https://gallium.inria.fr/~remy/mlf/proto/camlf_2011-08-29.zip";
        sha256 = "0240835f9c0d2ba9fa4c38240e7ff951caed2b149592d6c1678c61062f4e6743";
      };
      # 0.8.0 renamed the nested Default API used by the author's printer.
      # Restore the contemporaneous library rather than editing xPrint.ml.
      camomile = historical.stdenv.mkDerivation {
        pname = "camomile";
        version = "0.7.3";
        src = pkgs.fetchurl {
          url = "https://downloads.sourceforge.net/project/camomile/camomile/0.7.3/camomile-0.7.3.tar.bz2";
          sha256 = "b4ac4f0863ac8b15159e575d9528be133ddf9f8a78c07852b9ae047aef90a332";
        };
        buildInputs = [ ocaml.ocaml ocaml.findlib ];
        createFindlibDestdir = true;
      };
      adapter = pkgs.runCommand "camlf-observation-adapter-source" {} ''
        mkdir -p $out
        cp ${./collect.mjs} $out/collect.mjs
        cp ${./fixtures.json} $out/fixtures.json
        cp ${./verify-source.mjs} $out/verify-source.mjs
        cp ${./source-identities.json} $out/source-identities.json
      '';
      compiler = historical.stdenv.mkDerivation {
        pname = "camlf-author";
        version = "2011-08-29";
        src = archive;
        # OCaml 4.01 includes ocamlbuild; later compilers reserve the author's
        # `nonrec` identifier as syntax. Keep the old inference files intact.
        nativeBuildInputs = [ pkgs.unzip ocaml.ocaml ocaml.findlib ocaml.menhir ];
        buildInputs = [ camomile ];
        # The author's plugin unconditionally queries optional GUI/test
        # packages. The CLI never imports them. Disable only the build plugin
        # and supply its actual CLI libraries explicitly, leaving every source
        # file (including parser, solver, printer and main) byte-for-byte intact.
        buildPhase = ''
          ${pkgs.nodejs_22}/bin/node ${adapter}/verify-source.mjs "$PWD"
          ocamlbuild -classic-display -no-plugin -use-ocamlfind \
            -pkgs camomile,str,unix,bigarray main.d.byte
        '';
        installPhase = ''
          mkdir -p $out/bin $out/share/camlf
          cp _build/main.d.byte $out/bin/camlf
          cp -r Examples README LICENSE $out/share/camlf/
        '';
      };
      observations = pkgs.writeShellApplication {
        name = "camlf-observations";
        runtimeInputs = [ pkgs.nodejs_22 ];
        text = ''
          export CAMLF_EXE=${compiler}/bin/camlf
          exec node ${adapter}/collect.mjs "$@"
        '';
      };
    in {
      packages.${system} = { default = compiler; source = archive; };
      apps.${system} = {
        default = { type = "app"; program = "${compiler}/bin/camlf"; };
        observations = { type = "app"; program = "${observations}/bin/camlf-observations"; };
      };
      checks.${system}.observations = pkgs.runCommand "camlf-observation-check" {} ''
        ${observations}/bin/camlf-observations --check > summary.txt
        ${observations}/bin/camlf-observations > actual.json
        cmp actual.json ${./observed.json}
        cp actual.json $out
      '';
      devShells.${system}.default = pkgs.mkShell { packages = [ pkgs.nodejs_22 ]; };
    };
}
