# Pinned camlf inference witness

This builds the author's 2011 camlf CLI and runs twelve small gMLF inference
probes. It checks later graphical MLF behavior, rather than the original 2003
WF algorithm. The archive also implements xMLF elaboration/reduction and
experimental F-omega; those features are outside this witness.

## Source and build

The author-linked archive is
`https://gallium.inria.fr/~remy/mlf/proto/camlf_2011-08-29.zip`,
SHA-256 `0240835f9c0d2ba9fa4c38240e7ff951caed2b149592d6c1678c61062f4e6743`.
Its ZIP comment is `2700afe15305060e6d9caf0ccd7b3f00104910ac`.
The entire ZIP is fixed by that hash; `source-identities.json` additionally
checks 24 named parser, inference, printer, CLI and example files before
compilation. No author source file is patched.

The independent flake locks Nixpkgs and the historical package set. It uses
OCaml 4.01.0, Menhir 20140422 and Camomile 0.7.3. Later OCaml reserves the
author's `nonrec` identifier; Camomile 0.8.0 moved the nested `Default` API used
by xPrint.ml. Restoring old dependencies keeps these files intact.

The build command bypasses the author's ocamlbuild plugin, whose unconditional
queries require optional GUI/test packages even for the CLI. Instead it
supplies camomile, str, unix and bigarray explicitly with `-use-ocamlfind`.
The author's `_tags` and bundled PPrint remain unchanged; assertions and debug
compilation remain enabled. GUI and Kaputt test executables are not built.

From this directory, including after unpacking the standalone download:

```sh
nix run . -- -expr 'fun x -> fun y -> x'
nix run .#observations -- --check
nix run .#observations > actual.json
cmp actual.json observed.json
nix flake check
```

## What the observations establish

Ten fixtures infer a type and two produce unification rejections. Source
origins are recorded per fixture; some are isolated author examples, others
are our application/annotation controls. Each runs in a fresh process and
writable directory with the `dot/` directory expected by the default error
observer. stdout, stderr, exit status and generated DOT bytes are retained;
fresh-process repeats must match bytewise.

The constant function prints `'a. 'a → ('b. 'b → 'a)`, retaining the inner
quantifier. `choose id` prints a flexible identity bound. Annotating
self-application at the domain produces an independently polymorphic result,
while annotating its expression retains a rigid alias for domain and result.
These are the author's printed signatures, not a new equivalence oracle.

Three fixtures additionally run the author's `-trace_solve` observer. Their
graphs before each instantiation solve and their final answers are preserved.
The traced and ordinary paths must print the same final type. This bounded
observer check does not prove that observation is harmless for all inputs.

**A zero exit status does not mean acceptance.** The CLI reports caught typing
errors and returns its prior environment, so both type rejections and an
unbound-name control exit zero. The adapter accepts only a complete `val _`
signature or a recognized unification diagnostic. A separate malformed-syntax
control exits two; neither control counts among the twelve typed fixtures.
Unexpected diagnostics, including `Unknown error`, fail the adapter. Without
`dot/`, the default cycle-error observer instead throws a file error and hides
the intended rejection.

`main.ml` expands the solved scheme to a fresh root with `GSolve.normalize`
before printing it. `print_type.ml` then names shared/exposed nodes and inlines
others according to the arrow's rigid-domain/flexible-result convention.
This is more than a dump of the solver's original graph. The solve traces show
the earlier graphs; no instrumentation bypasses normalization, and no
independent proof equates every printed type with its graph.

No full author suite, xMLF execution, benchmark, soundness theorem or original
WF equivalence is claimed. The source note is
`notes/mlf-camlf-implementation.md` in the parent research repository.
