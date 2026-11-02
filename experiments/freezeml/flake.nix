{
  description = "Source-only pin of the announced Links FreezeML implementation";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4";
  inputs.links = {
    url = "github:links-lang/links/5ed2fa544249624b31348a14ad8391af0cf8fdfe";
    flake = false;
  };
  outputs = { self, nixpkgs, links }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      # This realizes and checks author source. It deliberately does not expose
      # a compiler app before an unchanged Links build has been established.
      audit = pkgs.runCommand "freezeml-author-source-audit" {
        nativeBuildInputs = [ pkgs.nodejs_22 ];
      } ''
        node ${./source-audit.mjs} ${links} ${./source-pin.json} \
          ${./upstream-specifications.json} > $out
      '';
    in {
      packages.${system}.default = audit;
      checks.${system}.source-audit = audit;
      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.nodejs_22 ];
      };
    };
}
