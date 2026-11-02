# Author prototype witness

This independent flake builds `juniorxxue/LCTI` commit
`c3c4634d1f2df5a69cab5fc6fa4cabb568000520`, `impl/Poly`, with GHC 9.10.3.
No Haskell source or inference rule is patched. Cabal metadata declares
`LICENSE` and `CHANGELOG.md` that are absent upstream; the build removes those
broken documentation-file declarations. It does not supply a made-up license.

```sh
nix run ./experiments/lcti                    # author's REPL
nix run ./experiments/lcti#check -- --check
nix run ./experiments/lcti#check -- --trace
nix run ./experiments/lcti#check -- --tree known-before-lambda
nix flake check ./experiments/lcti
```

Those commands are from the atlas research root. In the standalone download,
enter `lcti-witness` and replace `./experiments/lcti` with `.`.

`fixtures.json` supplies five assumed function types and 14 expressions. These
are inference tests, not evaluations of function bodies. The author's REPL
already assumes `id`, `single`, `choose`, etc. Our harness starts a fresh process
per fixture, validates its transcript, checks exact types or a genuine inference
failure, and distinguishes paper expectations from prototype observations.
The built-in `:tests` counts acceptance, including intentionally rejected cases;
it is not an expected-result regression oracle, so we do not use its pass count.

13 fixtures agree with the paper's rules, one records a prototype discrepancy:
`phantom : forall a. int -> int` applied to `1` is permitted by Figure 8
AS-∀L (discard the unused unsolved variable), but this executable says
`Error: No solution found`. `Infer.hs`'s `S-Forall-L` requires an `ESvar`
(solved) entry when leaving the scope. This discrepancy is preserved rather
than fixed behind the reader's back. It does not refute the paper's theorem.

`traces.txt` is our observed-result ledger. `twice-tree.txt` is the actual
ANSI-stripped author derivation; rule labels are the prototype's spellings.
Both are regenerated and compared byte-for-byte by the check. This is not a
rechecking of Agda/Rocq formalization, an exhaustive implementation audit,
or a claim that arbitrary programs follow the specification.
