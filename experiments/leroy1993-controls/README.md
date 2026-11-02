# Leroy 1993 bounded native evaluation controls

Run `node check.mjs` and compare with `observed.json`. The script reconstructs
a named subset of Figure3: integers, variables, closures, strict applications,
let-name, reference creation/access/update, callcc and continuation-first throw.
Let-val expands to an applied lambda (§2.1). Let-name uses lexical suspensions
rather than textual substitution, the alternative explicitly described in §3.2.
No conditional, recursion, general parser, inference, type generalization,
author compiler, benchmark or complete soundness proof is implemented.

Eight closed controls check answers/allocation counts with a1000-step guard.
Three callcc terms additionally carry supplied **ground** derivations under the
printed value-first throw rule and the proposed continuation-first variant.
This certificate checker handles only int/variable/lambda/callcc/throw with
fixed types. It performs no unification, polymorphic instantiation or search.
The printed-rule control types but returns wrong under Figure3's order;
the intended-order control evaluates correctly but has no printed-rule
certificate. These are separate statements, not a silent source-rule repair.
The proposed premise swap is not a verified repair of the whole theorem.

The main27-cell column remains entirely rule-derived. None of these native
observations relabels its typing cells E/S or grants a double-checked label.
