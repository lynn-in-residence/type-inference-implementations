import assert from 'node:assert/strict';

// A three-type witness for TR495 §§2.2/3.6 and TOPLAS2000 §5.7.
// Context Gamma = B<:Bot. This is not a Kernel Fun inferencer. The only
// quantified family examined is R(S)=All(Y<:S)Y->Y. S-Fun compares its bounds
// syntactically, so R(S)<:R(T) iff S=T. Alpha-renaming Y is already fixed.
const domain = ['Bot', 'B', 'Top'];
const same = (s, t) => s === t;
const subtype = (s, t) => same(s, t) || s === 'Bot' || t === 'Top'
  || (s === 'B' && t === 'Bot');
const equivalent = (s, t) => subtype(s, t) && subtype(t, s);
const resultSubtype = (s, t) => same(s, t);
const allPairs = predicate => domain.every(s => domain.every(t => predicate(s, t)));
const implies = (p, q) => !p || q;
const iff = (p, q) => p === q;

// TR495's necessary-condition wording and the journal's biconditionals are
// tested separately. For this family the predicates also have direct S-Fun
// derivations; finite enumeration alone is not a full variance decision method.
const predicates1997 = {
  covariant: allPairs((s, t) => implies(subtype(s, t), resultSubtype(s, t))),
  contravariant: allPairs((s, t) => implies(subtype(s, t), resultSubtype(t, s))),
  invariant: allPairs((s, t) => implies(resultSubtype(s, t), equivalent(s, t))),
  rigid: allPairs((s, t) => implies(resultSubtype(s, t), same(s, t)))
};
const predicates2000 = {
  constant: allPairs(resultSubtype),
  covariant: allPairs((s, t) => iff(resultSubtype(s, t), subtype(s, t))),
  contravariant: allPairs((s, t) => iff(resultSubtype(t, s), subtype(s, t))),
  invariant: allPairs((s, t) => iff(resultSubtype(s, t), equivalent(s, t))),
  rigid: allPairs((s, t) => iff(resultSubtype(s, t), same(s, t)))
};
const interval = { min: 'Bot', solutions: domain.filter(s => subtype('Bot', s) && subtype(s, 'Bot')) };
const exact = { min: 'Bot', solutions: domain.filter(s => same(s, 'Bot')) };
const tight = c => c.solutions.every(s => c.solutions.every(t => equivalent(s, t)));
const rigid = c => c.solutions.length === 1;
function select(p, c) {
  // The source ordering is preserved, including the invariant branch before
  // the rigid branch. null stands for undefined, not a synthesized bottom.
  if (p.constant || p.covariant) return c.min;
  if (p.contravariant) throw Error('not reached in this witness');
  if (p.invariant && tight(c)) return c.min;
  if (p.rigid && rigid(c)) return c.min;
  return null;
}
const observations = [];
function check(id, actual, expected) {
  assert.deepEqual(actual, expected, id);
  observations.push({ id, result: actual });
}
check('B-below-Bot', subtype('B', 'Bot'), true);
check('Bot-below-B', subtype('Bot', 'B'), true);
check('equivalent-but-not-identical', [equivalent('B', 'Bot'), same('B', 'Bot')], [true, false]);
check('interval-solutions', interval.solutions, ['Bot', 'B']);
check('equality-solutions', exact.solutions, ['Bot']);
check('interval-tight', tight(interval), true);
check('interval-not-rigid', rigid(interval), false);
check('equality-rigid', rigid(exact), true);
check('quantified-results-incomparable', [resultSubtype('Bot', 'B'), resultSubtype('B', 'Bot')], [false, false]);
check('no-least-result-for-interval', interval.solutions.filter(s => interval.solutions.every(t => resultSubtype(s, t))), []);
check('1997-necessary-predicates-overlap', predicates1997, {
  covariant: false, contravariant: false, invariant: true, rigid: true
});
check('2000-iff-predicates-separate', predicates2000, {
  constant: false, covariant: false, contravariant: false, invariant: false, rigid: true
});
const literal = select(predicates1997, interval);
check('1997-literal-branch-selects-Bot', literal, 'Bot');
check('literal-result-is-not-least', interval.solutions.every(t => resultSubtype(literal, t)), false);
check('2000-interval-choice-undefined', select(predicates2000, interval), null);
check('2000-equality-choice-Bot', select(predicates2000, exact), 'Bot');
check('equality-result-is-least', exact.solutions.every(t => resultSubtype('Bot', t)), true);
console.log(JSON.stringify({
  scope: 'TR495/TOPLAS variance wording witness; three bound types and one quantified family only',
  context: 'B<:Bot', family: 'R(S)=All(Y<:S)Y->Y', checks: observations.length, observations
}, null, 2));
