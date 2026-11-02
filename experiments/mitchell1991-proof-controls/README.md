# Mitchell source local proof controls

Run `node check.mjs`; exact expected JSON is `observed.json`.
The project flake check reruns and compares the output.

This small witness executes nine legal **one-step** variable-elimination cases
and one finite substitution-composition counterexample. The substitutions are
simultaneous and composition uses the paper's §5.2 convention. It counts literal
arrow occurrences in the remaining symbolic equations, not unique shared graph
nodes.

No recursive UNIFY, MATCH, G, GA, source-program parser, compiler, fixed-hierarchy
solver, semantic model, principal-typing inference or theorem repair. It tests
the two printed proof claims in Lemmas27/30 at stated concrete inputs, without
claiming their underlying algorithmic theorems are false or double-checked.
