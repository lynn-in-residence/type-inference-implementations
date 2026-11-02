import assert from 'node:assert/strict';

// A finite check of HHS2002 Example 6, not InferType or its diagnostic graph.
// The oracle is ordinary finite first-order unification with an occurs check.
const arrow = (domain, codomain) => ({domain, codomain});
const equations = [
  ['t1', 't2'], ['t1', 'Int'], ['Int', 'Int'],
  ['t3', 't5'], ['t3', 'Bool'], ['t4', 'Bool'], ['t4', 'Bool'],
  [arrow('t5', 't4'), arrow('Bool', 't6')],
  [arrow('t2', 'Int'), arrow('t6', 't7')],
];
const isVariable = t => typeof t === 'string' && !['Int', 'Bool'].includes(t);
function satisfiable(eqs) {
  const links = new Map();
  const prune = t => isVariable(t) && links.has(t) ? prune(links.get(t)) : t;
  function occurs(v, t) {
    t = prune(t);
    return t === v || (typeof t === 'object' && (occurs(v, t.domain) || occurs(v, t.codomain)));
  }
  function unify(a, b) {
    a = prune(a); b = prune(b);
    if (a === b) return true;
    if (isVariable(a)) {
      if (occurs(a, b)) return false;
      links.set(a, b); return true;
    }
    if (isVariable(b)) return unify(b, a);
    return typeof a === 'object' && typeof b === 'object'
      && unify(a.domain, b.domain) && unify(a.codomain, b.codomain);
  }
  return eqs.every(([a, b]) => unify(a, b));
}
const choose = mask => equations.filter((_, i) => mask & (1 << i));
const ids = mask => equations.flatMap((_, i) => mask & (1 << i) ? [i + 1] : []);
const all = (1 << equations.length) - 1;
const sat = Array.from({length: all + 1}, (_, mask) => satisfiable(choose(mask)));
const cores = [];
const repairs = [];
for (let mask = 0; mask <= all; mask++) {
  if (!sat[mask] && ids(mask).every(i => sat[mask ^ (1 << (i - 1))])) cores.push(ids(mask));
  if (sat[all ^ mask] && ids(mask).every(i => !sat[all ^ (mask ^ (1 << (i - 1)))])) repairs.push(ids(mask));
}
assert.deepEqual(cores, [[1, 2, 6, 8, 9], [1, 2, 7, 8, 9]]);
assert.deepEqual(repairs, [[1], [2], [6, 7], [8], [9]]);
assert.equal(satisfiable(equations.filter((_, i) => i !== 5)), false);
// Changing True's equation (#6) from Bool to Int still leaves False's #7.
assert.equal(satisfiable(equations.map((eq, i) => i === 5 ? ['t4', 'Int'] : eq)), false);

// Figure 3 allocates distinct types for the two x occurrences, application
// result, and lambda parameter. Printed p19 instead ties result to parameter.
const generatedSelf = [['u', arrow('v', 'r')], ['u', 'p'], ['v', 'p']];
const printedSelf = [['u', arrow('v', 'r')], ['u', 'r'], ['v', 'r']];
assert.equal(satisfiable(generatedSelf), false);
assert.equal(satisfiable(printedSelf), false);
// Without the application equation, only the printed aliases force r = u.
assert.equal(satisfiable([...generatedSelf.slice(1), ['u', 'Int'], ['r', 'Bool']]), true);
assert.equal(satisfiable([...printedSelf.slice(1), ['u', 'Int'], ['r', 'Bool']]), false);

console.log(JSON.stringify({
  scope: 'Finite literal-equation check, not HHS InferType or its graph heuristics',
  subsetsChecked: 512,
  minimalInconsistentConstraintSets: cores,
  inclusionMinimalRemovalSets: repairs,
  removingMReportedConstraint6Repairs: false,
  changingTrueToIntRepairs: false,
  selfApplication: {
    figure3: 'u = v -> r; u = p; v = p',
    printedPage19: 'u = v -> r; u = r; v = r',
    bothFailOccursCheck: true,
    applicationResultIncorrectlySharesParameterInPrintedAliases: true,
  },
}, null, 2));
