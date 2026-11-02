# FreezeML author source pin

This component pins Links 0.9 at
`5ed2fa544249624b31348a14ad8391af0cf8fdfe`, the historical release whose
[announcement](https://github.com/links-lang/links/releases/tag/0.9) explicitly
introduces FreezeML. It prepares a reproducible source baseline for a future
executable comparison. **It does not build Links or run inference.**

From the research repository, enter `experiments/freezeml`. For the standalone
download, unpack it and enter `freezeml-source-pin`. In either directory:

```sh
nix flake check
nix build --no-link --print-out-paths
```

The output is a source-audit report. The independently locked `links` input is
unchanged author code; SHA-256 checks cover the inference sources, grammar,
test harness, prelude/configuration and all eight file-based FreezeML fixtures.
`upstream-specifications.json` extracts the authors' 52 test specifications:
42 expect successful exit and ten expect rejection. These are expectations,
not observed results. One rejection is explicitly ignored upstream:
`Do not infer polymorphic arguments (3)`, whose reason says Mono kinds get
converted to Session. The harness executes that case and conditionally ignores
a mismatch; it does not skip it. The separate runtime witness below retains
both its declaration and actual outcome.

## Which language this pins

The [2020 paper](https://arxiv.org/abs/2004.00396) §6 identifies Links as its
implementation. Links includes effect rows, linearity/subkinds, richer
annotations and extra instantiation at eliminations. Its test prelude therefore
declares identity as `forall a, e::Row. (a) -e-> a`, including an effect row
quantifier. The fixture `poly($(fun(x:_::(Unl,Any)) { x }))` explicitly handles
the argument's subkind. Removing those details to resemble the paper would
change what is being tested.

Release 0.9 predates the PLDI 2020 paper. It is an announced implementation
baseline, not an asserted exact paper artifact. Current master was inspected
at `7100e2891346b5bae483fe9a02791c900047388a`; it is deliberately not the
input to this pin. The original core's rule-derived traces stay in the
[public source note](https://lynn.shit.yachts/writing/type-inference/freezeml-note-441f7132.md).

## Separate executable witness

`runtime/` independently builds the unchanged compiler and reproduces the
author harness. Its transcript audit exposes two missing filemode flags;
explicit file probes give 51 matching intended expectations and the author's
known session1 mismatch. See its README and `observed.json`. This parent flake
remains source-only; the older public source-pin archive remains immutable.

The distinct [2022 constraint-based follow-up](https://arxiv.org/abs/2207.09914)
is queued for an algorithm review. This source pin does not implement its
constraint language or stack solver.
