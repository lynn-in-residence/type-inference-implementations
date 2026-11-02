{
  description = "Pinned MLsub and paper-branch Simple-sub author prototypes";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4";
  inputs.simplesub = {
    url = "github:LPTK/simple-sub/9bae772624c23b52a93c1b226157e16898b4d9db";
    flake = false;
  };
  # Lock the submodule independently rather than trusting an updated branch head.
  inputs.mlsub = {
    url = "github:LPTK/mlsub/fdec44b80cfa5bdc010da9cc012e75a96d0dd19f";
    flake = false;
  };
  outputs = { self, nixpkgs, simplesub, mlsub }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      jar = group: name: version: hash: pkgs.fetchurl {
        url = "https://repo.maven.apache.org/maven2/${group}/${name}/${version}/${name}-${version}.jar";
        inherit hash;
      };
      # Match build.sbt's Scala 2.13.6 / fastparse 2.3.2 / sourcecode 0.2.7.
      # geny 0.6.7 is fastparse's declared transitive dependency.
      jars = [
        (jar "org/scala-lang" "scala-library" "2.13.6" "sha256-8Z7XMuFQ01N3lP0/5C7hhHCj9wfv1Jns0FqZ5yf/bIo=")
        (jar "org/scala-lang" "scala-reflect" "2.13.6" "sha256-9xNZOAmzh8YJNbualA386lO9Db+P3I0Qc5oolvisVvo=")
        (jar "org/scala-lang" "scala-compiler" "2.13.6" "sha256-MQ0mPWIqPQFpE+lO4AsRnScFc6XOqmshMS1pY3/Z7sE=")
        (jar "com/lihaoyi" "fastparse_2.13" "2.3.2" "sha256-fkMeSc4Ljh8QML2vzLTLEDktops7sWoXZnc0c1yMk30=")
        (jar "com/lihaoyi" "sourcecode_2.13" "0.2.7" "sha256-pjmpDi0hu6/YpeITxlRCqtIA7ghpUWBcvaiDW8bvEdM=")
        (jar "com/lihaoyi" "geny_2.13" "0.6.7" "sha256-o7hrfUKmj+oo3KO8DIsGpIcD2TQK27K1r0sFXi8GDT8=")
      ];
      classpath = pkgs.lib.concatStringsSep ":" (map toString jars);
      simple = pkgs.stdenvNoCC.mkDerivation {
        pname = "simple-sub-author";
        version = "9bae772";
        src = simplesub;
        nativeBuildInputs = [ pkgs.jdk17 pkgs.makeWrapper ];
        buildPhase = ''
          mkdir -p classes
          java -cp '${classpath}' scala.tools.nsc.Main -usejavacp -encoding UTF-8 \
            -d classes shared/src/main/scala/simplesub/*.scala \
            jvm/src/test/scala/Helpers.scala ${./Driver.scala}
        '';
        installPhase = ''
          mkdir -p $out/lib $out/bin
          cp -r classes $out/lib/
          makeWrapper ${pkgs.jdk17}/bin/java $out/bin/simple-sub \
            --add-flags "-cp $out/lib/classes:${classpath} simplesub.AtlasDriver"
        '';
      };
      ocaml = pkgs.ocaml-ng.ocamlPackages_4_14;
      ml = pkgs.stdenv.mkDerivation {
        pname = "mlsub-author";
        version = "fdec44b";
        src = mlsub;
        nativeBuildInputs = [ ocaml.ocaml ocaml.ocamlbuild ocaml.findlib ocaml.menhir ];
        buildInputs = [ ocaml.menhirLib ];
        buildPhase = ''make main.native'';
        installPhase = ''mkdir -p $out/bin; cp _build/main.native $out/bin/mlsub'';
      };
      witness = pkgs.writeShellApplication {
        name = "check-algebraic-subtyping";
        runtimeInputs = [ pkgs.nodejs_22 ];
        text = ''
          export LOCALE_ARCHIVE=${pkgs.glibcLocales}/lib/locale/locale-archive
          export LC_ALL=en_US.UTF-8
          export SIMPLE_SUB_BIN=${simple}/bin/simple-sub
          export MLSUB_BIN=${ml}/bin/mlsub
          exec node ${./.}/check.mjs "$@"
        '';
      };
    in {
      packages.${system} = { default = simple; simple-sub = simple; mlsub = ml; };
      apps.${system} = {
        default = { type = "app"; program = "${simple}/bin/simple-sub"; };
        mlsub = { type = "app"; program = "${ml}/bin/mlsub"; };
        check = { type = "app"; program = "${witness}/bin/check-algebraic-subtyping"; };
      };
      checks.${system}.witness = pkgs.runCommand "algebraic-subtyping-author-witness" {} ''
        ${witness}/bin/check-algebraic-subtyping --check > $out
        ${witness}/bin/check-algebraic-subtyping --trace > observed.json
        cmp observed.json ${./observed.json}
        ${witness}/bin/check-algebraic-subtyping --twice > twice.json
        cmp twice.json ${./twice.json}
      '';
    };
}
