# Simple sub source listing checks

Run from the research root:

```sh
node experiments/simple-sub-source-study/listing-check.mjs
node experiments/simple-sub-source-study/listing-check.mjs | cmp - experiments/simple-sub-source-study/observed.json
```

This bounded JavaScript transcription follows §3.3's coalescer on three manually
constructed variable states. It checks the literal §3.4.1 upper-bound example,
a negative-position control, and a candidate lower-bound state. It also routes
four distinct symbols through two printed arrow-merging examples and retains
the source's already recorded evaluation-count discrepancy.

It does not parse or infer a source program, solve subtype constraints, execute
the Scala inferencer, implement extrusion or simplification, or verify a theorem.
The original author comparison harness and its public archive remain unchanged.
The source boundary and local diagnoses are in notes/simple-sub-2020-source-study.md.
