# SuperF author web bundle probes

This runs the unchanged Scala.js author bundle from
`hkust-taco/superf@be9ece0d75d11e576f8c15a4f345900626d9138e`, SHA256
`37f3c2a1e57877877e45775dc8fc879b4a8a45d1ef2de667980e39a4ab0c1d24`.
The nested flake fetches that exact committed binary. No Scala recompilation,
inference patch, generated-code execution, or inference reconstruction occurs.
`UPSTREAM-Main.scala` is the hash-pinned source of its author UI entry point,
and `UPSTREAM-LICENSE` retains the MIT license. Bundle/source build identity
has not been independently reproduced.

Run `nix flake check` and `nix run --no-write-lock-file .` here.
There are fifteen fixed probes: ten accepts, three genuine type errors, one
unbound-identifier control (also reported by the type checker), and one parser
control. Every raw output and normalized text is compared with
`observations.json`. The type-error count includes the unbound control.

The Node adapter supplies only a textarea, output element and no-op logging.
Every fixture loads a fresh bundle instance, with the same identity-function
warmup used to initialize the author UI. It calls the author's lexical
`typecheck` export; a top-level `let` export is not an object property.
A ten-second VM timeout bounds each load/call. `node:vm` is not a security
boundary. Inputs are fixed trusted local probe strings; no network, process,
or filesystem interfaces are provided to the bundle by the adapter.

The author `Main.scala` sets `noRecursiveTypes=true`; the bundled inference
and simplifier remain unchanged. The paper's MLscriptF differs from its core
formalism (curried lambda generalization, recursive definitions, top-level def,
levels and printing), so these executions do not become an executed formal
SuperF matrix column. The exact flags and backend need further source review
before any broader equivalence claim.

Literal annotations `(1:int)` and `(true:bool)` deliberately widen MLscript's
singleton literal types to the two paper primitives. Tuple syntax has the
author printer's trailing comma. Explicit signatures use quoted type-variable
names, e.g. `forall 'a. 'a -> 'a`. These are documented translations for these
probes, not edits to the shared twenty-seven-fixture suite.

The probes expose three distinct facts: separate calls retain independent
results; introducing an eta helper merges the two flows and loses that
precision; self-application is accepted while its omega application trips the
recursion heuristic. A let/eta/contracted-lambda triple checks the paper's
Example4.3 scope boundary. The known-consumer probe corresponds to existing
row27 but belongs to this author-web profile. No full author suite, paper
metatheory, runtime semantics or double-checked implementation review is claimed.
