# Pinned MLsub / Simple-sub witness

Two unmodified author inference implementations, plus a small observation and
comparison adapter. This is a bounded executable comparison, not a new solver.

- Simple-sub: paper branch `mlsub-compare`, commit
  `9bae772624c23b52a93c1b226157e16898b4d9db`.
- MLsub: that branch's submodule, independently locked at
  `fdec44b80cfa5bdc010da9cc012e75a96d0dd19f`.
- Simple-sub toolchain: JDK 17, Scala 2.13.6, fastparse 2.3.2,
  sourcecode 0.2.7, geny 0.6.7. Fixed-hash Maven jars, compiled offline without
  SBT. Main sources and the author's `Helpers.scala` printer are unchanged.
- MLsub toolchain: OCaml 4.14.4, Menhir 20260203. Upstream README asks for
  OCaml 4.03.0, which this locked nixpkgs no longer packages. No OCaml or
  grammar changes were needed to compile with the newer toolchain.

From the atlas research root:

```sh
nix run ./experiments/algebraic-subtyping -- 'fun f -> fun x -> f (f x)'
nix run ./experiments/algebraic-subtyping#check -- --check
nix run ./experiments/algebraic-subtyping#check -- --trace
nix run ./experiments/algebraic-subtyping#check -- --twice
nix flake check ./experiments/algebraic-subtyping
```

For the standalone download, enter `algebraic-subtyping-witness` and replace
`./experiments/algebraic-subtyping` with `.`. `nix run .#mlsub -- FILE` runs
the author's file-mode interface. Its no-argument REPL throws on EOF; the
harness uses file mode and requires a clean exit.

## What is observed

`Driver.scala` parses one expression, creates a fresh Typer and calls:

1. `inferType`: retain its raw type and `showBounds` graph snapshot.
2. `coalesceType`: an unsimplified readable signature.
3. `compactType`: the author's compact polar representation.
4. `simplifyType`, then `coalesceCompactType`: final printed signature.

This is the pipeline in the author's `MLsubTests`, **not** the later
`canonicalizeType` pipeline in `TypingTests`. `--unobserved` bypasses the
intermediate observations. For each fixture the harness checks that both paths
produce the same final answer, then repeats the observed path in a fresh
process and checks bytewise determinism. This is an observer check on these
fixtures, not a proof that observation is harmless on every input.

MLsub's pinned `main.ml` already comments out automaton minimization in
`to_dscheme`; we preserve it exactly. Flow optimization and determinization
still run. Its printed twice type differs from Simple-sub's final type:

```text
Simple-sub: ('a ∨ 'b -> 'a) -> 'b -> 'a
MLsub:      ((a -> (b & a)) -> (a -> b))
```

The harness asks **MLsub's own** scheme-subsumption checker in both directions,
rather than requiring equal strings. The two judgments answer `[Y]`. This
shares an oracle with one of the solvers; it is not independent verification
of the subsumption algorithm. `int` versus `bool` answers `[N]` both ways as a
negative control. Record-printer commas become parser semicolons, following
the author's comparison adapter; raw output is retained unchanged.

## Fixture boundary

`fixtures.json` records origins and independently declared Simple-sub expected
signatures/errors. Most terms come directly from the pinned `TypingTests`;
the constant-twice specialization and extra-field record example are identified
atlas adaptations. MLsub gets ordinary definitions of `succ` and `add` using
its built-in integer arithmetic, to match Simple-sub's built-in assumptions.
Neither body is evaluated.

**13 shared-syntax fixtures:** ten accepted by both, three type-rejected by
both; 20 affirmative subsumption judgments. Identity, twice, its constant
specialization, record width/join, let polymorphism, two-sided scope extrusion,
self-application, a recursive record and §6’s finite-nested-record simplifier regression are included. Primitive mismatch,
missing field and invalid scope escape are genuine inference errors.

**One additional front-end probe:** Simple-sub accepts `{}`, but this pinned
MLsub parser cannot parse an empty record. Its `obj` and `typeobj` productions
require at least one field; it exits 2 with a Menhir parser exception. We record
this as a parser boundary, not a type-system disagreement. No parser patch or
replacement input conceals it. Separate malformed-input controls ensure parser
failures do not get counted as successful type rejections.

`observed.json` retains all Simple-sub stages, MLsub's raw stdout, actual checker
judgments, and the empty-record failure. `twice.json` extracts that one real
run. Both regenerate and compare bytewise in `nix flake check`.

No function evaluation, timing benchmark, million-case rerun, metatheory
rechecking, general equivalence theorem or arbitrary set-theoretic subtyping is
claimed. The paper's author-reported million-case result remains separate.
