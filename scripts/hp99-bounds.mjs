import assert from 'node:assert/strict';

// A bounded reconstruction of the subtype arguments in HP1999 §§4.1–4.2.
// This does not parse source programs or implement their F-omega inferencer.
// Constructors here are deliberately restricted to arrows, covariant List,
// and invariant Ref/OList; endpoints range over five ground types only.
const atoms = ['Bot', 'Int', 'Real', 'Bool', 'Top'];
const arrow = (domain, result) => ({ kind: 'arrow', domain, result });
const list = item => ({ kind: 'List', item });
const invariant = (kind, item) => ({ kind, item });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function subtype(left, right) {
  if (same(left, right) || left === 'Bot' || right === 'Top') return true;
  if (typeof left === 'string' || typeof right === 'string') {
    return left === 'Int' && right === 'Real';
  }
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    // Function domains reverse the subtype direction; results preserve it.
    case 'arrow': return subtype(right.domain, left.domain)
      && subtype(left.result, right.result);
    case 'List': return subtype(left.item, right.item);
    case 'Ref': case 'OList': return same(left.item, right.item);
    default: throw new Error(`unknown constructor ${left.kind}`);
  }
}
const lower = (values, order) => values.filter(x => values.every(y => order(x, y)));
const upper = (values, order) => values.filter(x => values.every(y => order(y, x)));
const within = (low, x, high) => subtype(low, x) && subtype(x, high);
const pairs = (xs, ys) => xs.flatMap(X => ys.map(Y => ({ X, Y })));
const expectedArgument = ({ X, Y }) => arrow(X, Y);
const output = ({ Y }) => list(Y);
const combined = p => arrow(expectedArgument(p), output(p));

// Validate the finite relation itself before using it as an oracle. These
// sanity checks do not establish any metatheorem for arbitrary source types.
const types = [...atoms, ...atoms.map(list), ...atoms.map(x => invariant('Ref', x)),
  ...atoms.map(x => invariant('OList', x)),
  ...pairs(atoms, atoms).map(expectedArgument),
  ...pairs(atoms, atoms).map(combined)];
for (const t of types) assert(subtype(t, t));
for (const a of types) for (const b of types) for (const c of types) {
  if (subtype(a, b) && subtype(b, c)) assert(subtype(a, c));
}

const observations = [];
function check(id, actual, expected) {
  assert.deepEqual(actual, expected, id);
  observations.push({ id, result: actual });
}

// Ref 1 permits X above Int, but invariant Ref cannot promote between these
// choices. The lack of a least result differs from absence of any solution.
const refChoices = atoms.filter(x => within('Int', x, 'Top'));
check('reference-choices', refChoices, ['Int', 'Real', 'Top']);
check('reference-no-least-result', lower(refChoices,
  (x, y) => subtype(invariant('Ref', x), invariant('Ref', y))), []);
check('empty-object-bottom-blocks-add', subtype('Int', 'Bot'), false);
check('empty-object-top-blocks-extraction', subtype('Top', 'Int'), false);

// Source example: map (lambda x.plus x 1) l0, l0:List Int, expected List Int.
// Skip the lambda provisionally. The other argument and result supply bounds.
const Xs = atoms.filter(x => within('Int', x, 'Top'));
const boundedYs = atoms.filter(y => within('Bot', y, 'Int'));
const checking = pairs(Xs, boundedYs);
check('annotated-constraint-solutions', checking.length, 6);
check('arbitrary-choice-satisfies-bounds', checking.some(p =>
  p.X === 'Int' && p.Y === 'Bot'), true);
// plus:Int -> Int -> Int: x:X must fit Int, and its Int result must fit Y.
const lambdaChecks = ({ X, Y }) => subtype(X, 'Int') && subtype('Int', Y);
check('arbitrary-choice-fails-body', lambdaChecks({ X: 'Int', Y: 'Bot' }), false);
const largestGoals = upper(checking, (a, b) =>
  subtype(expectedArgument(a), expectedArgument(b)));
check('maximum-argument-goal', largestGoals, [{ X: 'Int', Y: 'Int' }]);
check('maximum-argument-goal-checks-body', largestGoals.every(lambdaChecks), true);

// With no result annotation, Y may range over all atoms. A maximal lambda
// goal and a minimal output now disagree. Their combined function type has
// both polarities in Y. This bounded check is not a general inference theorem.
const synthesizing = pairs(Xs, atoms);
check('unannotated-no-least-combined-result', lower(synthesizing,
  (a, b) => subtype(combined(a), combined(b))), []);
check('opposite-Y-endpoints-incomparable', [
  subtype(combined({ X: 'Int', Y: 'Bot' }), combined({ X: 'Int', Y: 'Top' })),
  subtype(combined({ X: 'Int', Y: 'Top' }), combined({ X: 'Int', Y: 'Bot' }))
], [false, false]);

// HP p.4's introductory sentence reverses arrow variance. Record the ordinary
// substitution check separately; no assertion about their compiler follows.
check('arrow-domain-reverses-codomain-preserves',
  subtype(arrow('Int', 'Int'), arrow('Bot', 'Top')), true);

console.log(JSON.stringify({
  scope: 'bounded HP1999 subtype arguments; no source inferencer or author rerun',
  atoms, checks: observations.length, observations
}, null, 2));
