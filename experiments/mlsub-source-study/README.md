# MLsub source study probes

Targeted unchanged author-code inference, not a new implementation. The build
comes from `../algebraic-subtyping/flake.nix` and its locked MLsub fdec44b input.
From the research root:

```sh
bin=$(nix build --no-link --print-out-paths ./experiments/algebraic-subtyping#mlsub)
node experiments/mlsub-source-study/check.mjs "$bin/bin/mlsub" >/tmp/mlsub-study.json
cmp /tmp/mlsub-study.json experiments/mlsub-source-study/observed.json
```

Seven successes, one type-error control, four author subsumption queries and
one parser control. Each inference/subsumption run repeats in a fresh process.
No evaluation, benchmark, full suite or independent subtype-oracle claim.
Integer arithmetic is a prototype extension to the paper's Bool/record core.
Both mixed-argument examples encode pairs as named records. This study adds no
shared term, profile or matrix cell. The original witness remains immutable.

`core-sanity.ml` / `core-sanity.stdout` add a later, separate source pass.
The first three definitions are exact pure shared terms 7/9/10. The fourth
uses native `if true then ... else ...` in place of the fixture's declared
curried IF, so it is only a related-program sanity check. It is not recorded
as execution of row14. No old check.mjs/observed.json/archive bytes change.

```sh
"$bin/bin/mlsub" experiments/mlsub-source-study/core-sanity.ml >/tmp/core-sanity.stdout
cmp /tmp/core-sanity.stdout experiments/mlsub-source-study/core-sanity.stdout
```
