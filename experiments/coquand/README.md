# Coquand 1996: eight bounded checks of the author-linked correction

Run `nix flake check`, `nix run`, or `nix build --no-link --print-out-paths`.
The nested lock fixes the compiler environment. The flake fetches the author's
`https://www.cse.chalmers.se/~coquand/conv1.hs` at SHA256
`dcaf53eb3296f922034a52d7f5ada85c84f36ac2ce6d6580a3c064f1f1a39e75`.
No author source is changed. A Control.Exception import is prepended, then
Probe.hs is appended; exceptions are recorded distinctly from False/True.
The 30-second whole-run limit bounds this experiment, not the calculus.

Expected paper behavior, in the same order as observed.tsv: True; no standalone
lambda synthesis; True; True; True; reject; True; unbound-variable error.
Six probes agree. Two deliberately pin mismatches rather than patching them:

- `Let "x" Type (Pi "A" Type (Var "A")) Type` returns True, although the
  paper's §3 requires checking the assigned Type at the annotated Pi type.
  That missing premise fails under the paper's §2.4/§2.3 checking/conversion.
- `Let "id" (Abs "x" (Var "x")) (Pi "x" Type Type) (Var "id")`
  should check at Pi x:Type.Type but throws `cannot infer type`.

Let's order here is value, annotation, body, as specified by the paper's §3,
the evaluator, and the original printed appendix. The fetched correction's
checking branch instead initially checks e1 as a type and e2 at that type,
while its evaluator and environment updates keep value-first order. This
is an observed mismatch in this pinned file, not a claim about every release
of the author's checker or an independently repaired soundness theorem.

The separate original 13-page author preprint contains other printed slips,
and its appendix lacks the value-check premise. That appendix was read and
visually inspected, not compiled here. No full author suite, normalizing
universe adaptation, independent source-to-code review, or metatheory recheck.
No main atlas matrix cells are contributed by these appendix-specific probes.
