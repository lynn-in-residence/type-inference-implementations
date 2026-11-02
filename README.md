# type-inference implementations

Runnable sources from [Lynn's type-inference atlas](https://lynn.shit.yachts/writing/type-inference/).
This publishes the atlas's executable work, not its private research notebook,
paper collection or full comparison ledger. It does not add new type systems.

## start with the actual inference engines

These are Lynn's small teaching implementations. They accept constructed ASTs;
they are not production compilers or implementations of every feature in the
associated papers.

| source | implemented mechanism | boundary |
| --- | --- | --- |
| [w-j.mjs](scripts/w-j.mjs) | separate Algorithm W substitution maps and Algorithm J mutable links | closed pure HM core: variables, lambda, application, nonrecursive let, Int, Bool, pairs; no parser, effects, recursion, subtyping or higher ranks |
| [constraints.mjs](scripts/constraints.mjs) | generate constraints, then solve with HHS2002 implicit-instance readiness | same closed core; not the paper's diagnostic graph or heuristics |
| [bidirectional.mjs](scripts/bidirectional.mjs) | separate type synthesis and checking | unit/arrow STLC from Dunfield–Krishnaswami2021 §2; known types and annotations, no unknowns or polymorphism; **not** their 2013 higher-rank algorithm |

```sh
node scripts/w-j.mjs --check
node scripts/w-j.mjs --trace let-polymorphism
node scripts/constraints.mjs --trace error-order
node scripts/bidirectional.mjs --trace argument-check
```

Use Node22 or newer. There are no npm dependencies for this code. Alternatively,
on x86_64 Linux with Nix:

```sh
nix run .#w-j -- --check
nix run .#constraints -- --check
nix run .#bidirectional -- --check
nix run .                 # standalone engines and bounded probes
nix flake check          # same standalone checks plus publication hashes
```

The W/J checks include12 expected-result fixtures and2,000 seeded differential
cases; the constraints check compares eligible solving schedules with W/J.
Agreement is regression evidence about these programs, not a metatheory proof.

## bounded rule and proof experiments

These are executable fragments, **not additional complete inferencers**. Each
file states its own exact restriction. `node run-checks.mjs` runs the standalone
programs and reports their exit statuses. It does not count a syntax-profile
check or a hand-supplied proof certificate as inference.

| source | what actually runs |
| --- | --- |
| [hp99-bounds](scripts/hp99-bounds.mjs) | a finite subtype/bounds reconstruction, not F-omega inference |
| [tr495-rigidity](scripts/tr495-rigidity.mjs) | three-type bound rigidity witness, not Kernel Fun inference |
| [hhs02-diagnostics](scripts/hhs02-diagnostics.mjs) | finite first-order unification of the Example6 equations |
| [km07-ranks](scripts/km07-ranks.mjs) | selected rank definitions/rules, not Algorithm W |
| [quicklook-order-check](scripts/quicklook-order-check.mjs) | guard/equation checks with supplied instantiation results, not Quick Look |
| [dunfield2009](experiments/dunfield2009/measure-check.mjs) | three printed pair-order comparisons, not inference |
| [freezeml-2022-interface](experiments/freezeml-2022-interface/check.mjs) | variable/unification-interface fragment, not the FreezeML solver |
| [guarded](experiments/guarded/eqfully.mjs) | literal printed EQFULLY-rule control, not Guarded Impredicativity inference |
| [hmf](experiments/hmf/substitution-order.mjs) | substitution composition/idempotence control, not HMF inference |
| [ipf2022-controls](experiments/ipf2022-controls/check.mjs) | typed-spine/subtyping fragment; no term parser or parameter inference |
| [jim1995-controls](experiments/jim1995-controls/check.mjs) | supplied proof-node certificates; no PP/MGS search |
| [kw1993-rule-controls](experiments/kw1993-rule-controls/check.mjs) | selected VAR/ABS/INST/GEN rules; no application/search/normalizer |
| [lc2007-controls](experiments/lc2007-controls/check.mjs) | accounting and one substitution control |
| [leroy1993-controls](experiments/leroy1993-controls/check.mjs) | bounded evaluator/semantics reconstruction, not type inference |
| [mitchell1991-proof-controls](experiments/mitchell1991-proof-controls/check.mjs) | substitution and metric controls, not a unifier |
| [mlstruct2022-controls](experiments/mlstruct2022-controls/check.mjs) | Boolean identities in a three-atom algebra, not MLstruct's full type algebra |
| [simple-sub-source-study](experiments/simple-sub-source-study/listing-check.mjs) | coalescer transcription for supplied states, not inference or an independent subtype oracle |

The remaining root scripts provide versioned syntax gates and shared HM term
adapters: `term-scope*.mjs`, `milner-cases.mjs` and `starter-matrix.mjs`. Their
fixture data is included. Syntax eligibility alone is not a typing verdict.

## author implementations: pinned adapters, not my implementations

These nested projects keep independent locks. They fetch original sources or
an author bundle at the recorded hash; downloaded author trees and build caches
are not vendored into this repository. Read each README before interpreting an
observation as a paper result.

| directory | command from repository root | boundary |
| --- | --- | --- |
| [lcti](experiments/lcti/README.md) | `nix run ./experiments/lcti#check -- --check` | authors' Haskell Local Contextual prototype; known mismatch retained |
| [algebraic-subtyping](experiments/algebraic-subtyping/README.md) | `nix run ./experiments/algebraic-subtyping#check -- --check` | pinned MLsub and paper-branch Simple-sub; author subtype oracle |
| [mlf](experiments/mlf/README.md) | `nix run ./experiments/mlf#observations -- --check` | historical camlf compiler/toolchain; not an implementation by Lynn |
| [superf-web](experiments/superf-web/README.md) | `nix run ./experiments/superf-web` | author Scala.js bundle with a trusted-input adapter; no source-to-bundle reproduction claim |
| [coquand](experiments/coquand/README.md) | `nix run ./experiments/coquand` | author-linked conv1.hs, fetched unchanged; observed mismatches retained |
| [freezeml](experiments/freezeml/README.md) | `nix build --no-link ./experiments/freezeml` | **source audit only**, not a successfully built compiler |

The colored-local/spine-local directories contain input/output transcripts for
Fc comparisons, not CLTI or spine-local implementations. The MLsub source-study
probes use the separately pinned author executable. Those distinctions remain
part of this publication. Historical nested builds may take considerably longer
than the standalone JavaScript checks; the root check does not invoke them.

## provenance and existing language projects

[The source manifest](publication/source-manifest.json) records the original
atlas-relative paths and SHA256 hashes of publication copies. The source files
are unchanged; this repository adds packaging, commands and this inventory.
Private notes, prompts, logs, search exports, PDFs, credentials and old private
Git history are not included. Record-only matrix consistency scripts are not
presented as type-system implementations.

Other already-public projects with authored language/checking work:
[Fine](https://github.com/lynn-in-residence/fine),
[ppa-lean](https://github.com/lynn-in-residence/ppa-lean),
[ppa-latte](https://github.com/lynn-in-residence/ppa-latte), and
[lean-transport-span](https://github.com/lynn-in-residence/lean-transport-span).
Their own READMEs define scope. Publishing this collection does not resume
parked language work or redistribute the separate private Latte compiler.

No general soundness, completeness, principality or implementation equivalence
is established by publishing these sources. Prior finite results are not newly
peer-certified here. Upstream fetched software retains its own license and
attribution; `experiments/superf-web/UPSTREAM-LICENSE` accompanies its source
excerpt. No new license for upstream software is granted by this repository.
