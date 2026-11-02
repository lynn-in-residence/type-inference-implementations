// An isolated check of the two printed §5.7 examples, not a Quick Look inferencer.
// We supply the instantiation results explicitly. Only the Figure 5 guard
// predicate and the ensuing finite type equations are evaluated here.
import assert from 'node:assert/strict';

const iv = name => ({ tag: 'inst', name });
const bound = name => ({ tag: 'bound', name });
const con = (name, ...args) => ({ tag: 'con', name, args });
const list = t => con('List', t);
const I = { tag: 'forall', name: 'c', body: con('Arrow', bound('c'), bound('c')) };
const fiv = t => t.tag === 'inst' ? [t.name]
  : t.tag === 'con' ? [...new Set(t.args.flatMap(fiv))]
  : t.tag === 'forall' ? fiv(t.body) : [];
const apply = (t, s) => t.tag === 'inst' && Object.hasOwn(s, t.name)
  ? apply(s[t.name], s)
  : t.tag === 'con' ? con(t.name, ...t.args.map(a => apply(a, s)))
  : t.tag === 'forall' ? { ...t, body: apply(t.body, s) } : t;
const show = t => t.tag === 'inst' ? t.name : t.tag === 'bound' ? t.name
  : t.tag === 'forall' ? `forall ${t.name}.(${show(t.body)})`
  : `${t.name}${t.args.length ? `(${t.args.map(show).join(',')})` : ''}`;

// These equations never need to unify under two different forall binders.
// Identical closed I values are equal; any other forall comparison is refused.
function unify(a, b, s) {
  a = apply(a, s); b = apply(b, s);
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a.tag === 'inst') {
    assert(!fiv(b).includes(a.name), 'occurs check'); s[a.name] = b; return;
  }
  if (b.tag === 'inst') return unify(b, a, s);
  assert(a.tag === 'con' && b.tag === 'con', 'outside this finite check');
  assert.equal(a.name, b.name); assert.equal(a.args.length, b.args.length);
  a.args.forEach((x, i) => unify(x, b.args[i], s));
}
function inspect(expected, actual, s) {
  expected = apply(expected, s); actual = apply(actual, s);
  const guarded = expected.tag === 'con';
  const noFreeInstantiationVariables = fiv(actual).length === 0;
  assert(guarded || noFreeInstantiationVariables, 'Figure 5 app-QL premise');
  unify(expected, actual, s);
  return { expected: show(expected), actual: show(actual), guarded,
    noFreeInstantiationVariables,
    substitution: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, show(apply(v, s))])) };
}
function run(order) {
  const s = {}, k = iv('kappa'), m = iv('mu');
  const steps = order === 'f1 x1 x2'
    ? [inspect(list(k), list(list(m)), s), inspect(k, list(I), s)]
    : [inspect(k, list(I), s), inspect(list(k), list(list(m)), s)];
  assert.deepEqual(apply(k, s), list(I));
  assert.deepEqual(apply(m, s), I);
  // Normal checking gets exactly the supplied argument types after QL.
  assert.deepEqual(apply(list(list(m)), s), list(list(I)));
  return { call: order, steps, finalKappa: show(apply(k, s)), finalMu: show(apply(m, s)) };
}
const cases = [run('f1 x1 x2'), run('f2 x2 x1')];
assert.equal(cases[1].steps[0].guarded, false);
assert.equal(cases[1].steps[0].noFreeInstantiationVariables, true);
assert.equal(cases[0].finalKappa, cases[1].finalKappa);
console.log(JSON.stringify({
  scope: 'Two supplied-instantiation guard/equation checks only; no term inference, GHC execution, completeness or proof review.',
  source: 'Quick Look 2020 Figure 5 and section 5.7, Microsoft SHA79ff3279; corresponding passages also present in January 2026 author copy SHAcd2702e5.',
  context: { f1: 'forall a.List(a)->a->Int', f2: 'forall a.a->List(a)->Int', x1: 'forall b.List(List(b))', x2: 'List(forall c.c->c)' },
  cases
}, null, 2));
