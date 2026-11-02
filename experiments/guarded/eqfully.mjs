import assert from 'node:assert/strict';

// Isolated check of Figure 8 EQFULLY's printed right-hand side, not a GI solver.
// Source: guarded-impredicative-extended.pdf, page 10, SHA-256 b82870d0...2e13cd8.
// Both RHS types below are nullary constructors, so fuv(sigma) is empty.
// The printed replacement adds only demotion equalities and drops the input.
const input = [
  {variable:'alpha', sort:'m', type:'Int'},
  {variable:'alpha', sort:'m', type:'Bool'},
];
const freeUnificationVariables = type => {
  assert(['Int','Bool'].includes(type)); // deliberately only these two atoms
  return [];
};
const literalEqFully = equality => freeUnificationVariables(equality.type)
  .filter(variable => variable.sort !== 'm')
  .map(variable => ({variable:variable.name, sort:variable.sort, type:'fresh-m'}));
const trace = [input];
// CONJ permits each equality to be rewritten in the enclosing conjunction.
trace.push([...literalEqFully(input[0]), input[1]]);
trace.push(trace[1].flatMap(literalEqFully));
assert.equal(new Set(input.map(e=>e.type)).size,2);
assert.deepEqual(trace.map(step=>step.length),[2,1,0]);
assert.deepEqual(trace.at(-1),[]);
console.log(JSON.stringify({
  scope:'literal EQFULLY with Int/Bool atoms only; no author implementation',
  input:'exists alpha:m. alpha ~ Int and alpha ~ Bool',
  inconsistent:true,
  equalityCounts:trace.map(step=>step.length),
  final:'empty conjunction (true)',
  limitation:'printed rewrite loses an obligation; no repaired solver or metatheory',
},null,2));
