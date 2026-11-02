import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixtures as hmFixtures, inferW, inferJ } from './w-j.mjs';

// A small closed-term implementation of Heeren–Hage–Swierstra 2002 §4.
// Generation creates equality/implicit-instance constraints without solving.
// Only the second phase mutates type-variable links. It is not their §6
// diagnostic graph or an implementation of Wand's different goal worklist.
const con = (name, ...args) => ({ tag: 'con', name, args });
const arrow = (a, b) => con('arrow', a, b);
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const minus = (a, b) => new Set([...a].filter(x => !b.has(x)));
const intersects = (a, b) => [...a].some(x => b.has(x));
class InferenceFailure extends Error {
  constructor(code, origin) { super(`${code} at ${origin}`); this.code = code; this.origin = origin; }
}

export function inferConstraints(term, { order = 'forward', trace = [], unsafeGeneralize = false } = {}) {
  if (!['forward', 'reverse'].includes(order)) throw new Error(`unknown schedule ${order}`);
  let next = 0;
  const fresh = () => ({ tag: 'var', id: next++, link: null });
  const constraints = [];
  const equation = (left, right, origin) => constraints.push({ kind: 'eq', left, right, origin });
  const merge = (...assumptions) => assumptions.flat();
  const generate = (e, monomorphic = [], path = 'root') => {
    switch (e.tag) {
      case 'int': return { type: con('Int'), assumptions: [] };
      case 'bool': return { type: con('Bool'), assumptions: [] };
      case 'var': {
        const type = fresh();
        return { type, assumptions: [{ name: e.name, type, path }] };
      }
      case 'app': {
        const fn = generate(e.fn, monomorphic, `${path}.fn`);
        const arg = generate(e.arg, monomorphic, `${path}.arg`);
        const type = fresh();
        equation(fn.type, arrow(arg.type, type), `${path}: application`);
        return { type, assumptions: merge(fn.assumptions, arg.assumptions) };
      }
      case 'pair': {
        const left = generate(e.left, monomorphic, `${path}.left`);
        const right = generate(e.right, monomorphic, `${path}.right`);
        return { type: con('product', left.type, right.type), assumptions: merge(left.assumptions, right.assumptions) };
      }
      case 'lam': {
        const parameter = fresh();
        const body = generate(e.body, [...monomorphic, parameter], `${path}.body`);
        // Occurrences start independent; the lambda connects all of them to
        // one monotype. Each equation retains the source occurrence it binds.
        for (const a of body.assumptions.filter(a => a.name === e.name))
          equation(a.type, parameter, `${a.path}: lambda-bound ${e.name}`);
        return { type: arrow(parameter, body.type), assumptions: body.assumptions.filter(a => a.name !== e.name) };
      }
      case 'let': {
        const value = generate(e.value, monomorphic, `${path}.value`);
        const body = generate(e.body, monomorphic, `${path}.body`);
        for (const a of body.assumptions.filter(a => a.name === e.name))
          constraints.push({ kind: 'implicit', left: a.type, right: value.type,
            monomorphic: [...monomorphic], origin: `${a.path}: let-bound ${e.name}` });
        // Nonrecursive let: the name binds only body occurrences. Free uses
        // in its definition still refer to an outer binding, if one exists.
        return { type: body.type, assumptions: merge(value.assumptions, body.assumptions.filter(a => a.name !== e.name)) };
      }
      default: throw new Error(`unknown syntax ${e.tag}`);
    }
  };
  const generated = generate(term);
  if (generated.assumptions.length) throw new InferenceFailure('unbound-variable', generated.assumptions[0].path);
  // Everything above constructs nodes; these nodes have no solution links yet.
  const resolve = t => {
    if (t.tag !== 'var' || !t.link) return t;
    t.link = resolve(t.link);
    return t.link;
  };
  const ftv = original => {
    const t = resolve(original);
    return t.tag === 'var' ? new Set([t.id]) : union(...t.args.map(ftv));
  };
  const monomorphicFtv = c => union(...c.monomorphic.map(ftv));
  const active = c => c.kind === 'eq' ? union(ftv(c.left), ftv(c.right))
    : union(ftv(c.left), new Set([...ftv(c.right)].filter(id => monomorphicFtv(c).has(id))));
  const show = (type, canonical = false) => {
    const names = new Map();
    const go = (original, precedence = 0) => {
      const t = resolve(original);
      if (t.tag === 'var') {
        if (!canonical) return `t${t.id}`;
        if (!names.has(t.id)) { const n = names.size; names.set(t.id, n < 26 ? String.fromCharCode(97 + n) : `a${n}`); }
        return names.get(t.id);
      }
      if (t.name === 'arrow') {
        const text = `${go(t.args[0], 1)} -> ${go(t.args[1])}`;
        return precedence ? `(${text})` : text;
      }
      if (t.name === 'product') return `(${go(t.args[0], 1)} * ${go(t.args[1], 1)})`;
      return t.name;
    };
    return go(type);
  };
  const describe = c => c.kind === 'eq' ? `${show(c.left)} = ${show(c.right)}`
    : `${show(c.left)} instance-of ${show(c.right)} except {${[...monomorphicFtv(c)].map(id => `t${id}`).join(', ')}}`;
  constraints.forEach((c, i) => { c.id = i + 1; });
  trace.push('GENERATE (no unification)');
  constraints.forEach(c => trace.push(`#${c.id} ${describe(c)} [${c.origin}]`));
  trace.push(`SOLVE (${order})`);
  const unify = (a, b, origin) => {
    const left = resolve(a), right = resolve(b);
    if (left.tag === 'var') {
      if (right.tag === 'var' && left.id === right.id) return;
      if (ftv(right).has(left.id)) throw new InferenceFailure('occurs-check', origin);
      left.link = right;
      return;
    }
    if (right.tag === 'var') return unify(right, left, origin);
    if (left.name !== right.name || left.args.length !== right.args.length)
      throw new InferenceFailure('constructor-clash', origin);
    left.args.forEach((t, i) => unify(t, right.args[i], origin));
  };
  while (constraints.length) {
    const eligible = constraints.map((c, index) => {
      if (c.kind === 'eq' || unsafeGeneralize) return index;
      const candidates = minus(ftv(c.right), monomorphicFtv(c));
      const elsewhere = union(...constraints.filter(other => other !== c).map(active));
      return intersects(candidates, elsewhere) ? -1 : index;
    }).filter(index => index >= 0);
    // §4.3 Lemma 1 supplies progress for constraints generated by these rules.
    // A blocked generated set is an implementation bug, not a rejected term.
    if (!eligible.length) throw new Error('generated constraint set blocked');
    const index = order === 'reverse' ? eligible.at(-1) : eligible[0];
    const c = constraints[index];
    if (c.kind === 'eq') {
      trace.push(`solve #${c.id}: ${describe(c)}`);
      unify(c.left, c.right, c.origin);
      constraints.splice(index, 1);
    } else {
      const quantified = minus(ftv(c.right), monomorphicFtv(c));
      const replacements = new Map();
      const instantiate = original => {
        const t = resolve(original);
        if (t.tag !== 'var') return con(t.name, ...t.args.map(instantiate));
        if (!quantified.has(t.id)) return t;
        if (!replacements.has(t.id)) replacements.set(t.id, fresh());
        return replacements.get(t.id);
      };
      trace.push(`generalize #${c.id}: ${describe(c)}; freshen {${[...quantified].map(id => `t${id}`).join(', ')}}`);
      // Collapse the paper's explicit-instance intermediate into instantiation.
      // Keeping the resulting equality in the queue still permits scheduling.
      constraints[index] = { ...c, kind: 'eq', right: instantiate(c.right) };
    }
  }
  return show(generated.type, true);
}

const v = name => ({ tag: 'var', name });
const lam = (name, body) => ({ tag: 'lam', name, body });
const app = (fn, arg) => ({ tag: 'app', fn, arg });
const letIn = (name, value, body) => ({ tag: 'let', name, value, body });
const pair = (left, right) => ({ tag: 'pair', left, right });
const int = { tag: 'int' }, bool = { tag: 'bool' };
export const fixtures = [...hmFixtures,
  { name: 's-combinator', source: 'fun x -> fun y -> fun z -> x z (y z)',
    term: lam('x', lam('y', lam('z', app(app(v('x'), v('z')), app(v('y'), v('z')))))), expected: '(a -> b -> c) -> (a -> b) -> a -> c' },
  { name: 'monomorphic-set', source: 'fun m -> let y = m in let x = y true in x',
    term: lam('m', letIn('y', v('m'), letIn('x', app(v('y'), bool), v('x')))), expected: '(Bool -> a) -> a' },
  { name: 'error-order', source: 'fun f -> (f 1, f true)',
    term: lam('f', pair(app(v('f'), int), app(v('f'), bool))), error: 'constructor-clash' },
  { name: 'definition-sees-outer', source: 'fun x -> let x = x in x',
    term: lam('x', letIn('x', v('x'), v('x'))), expected: 'a -> a' },
  { name: 'captured-shadow', source: 'fun x -> let x = fun y -> x in (x 1, x true)',
    term: lam('x', letIn('x', lam('y', v('x')), pair(app(v('x'), int), app(v('x'), bool)))), expected: 'a -> (a * a)' }
];

function outcome(engine, term, options) {
  try { return { type: engine(term, options) }; }
  catch (error) {
    if (!['constructor-clash', 'occurs-check', 'unbound-variable'].includes(error.code)) throw error;
    return { error: error.code, ...(error.origin ? { origin: error.origin } : {}) };
  }
}
export function check() {
  for (const f of fixtures) for (const order of ['forward', 'reverse']) {
    const result = outcome(inferConstraints, f.term, { order });
    assert.equal(result.type ?? result.error, f.expected ?? f.error, `${order}: ${f.name}`);
  }
  const guarded = fixtures.find(f => f.name === 'monomorphic-set');
  const unsafe = inferConstraints(guarded.term, { unsafeGeneralize: true });
  assert.notEqual(unsafe, guarded.expected, 'removing the instance readiness gate must break this regression');

  let state = 0x434f2026, binder = 0;
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 0x100000000 * n); };
  const generate = (depth, env) => {
    if (!depth) return env.length && random(3) === 0 ? v(env[random(env.length)]) : random(2) ? int : bool;
    switch (random(6)) {
      case 0: return generate(0, env);
      case 1: { const name = `x${binder++}`; return lam(name, generate(depth - 1, [...env, name])); }
      case 2: return app(generate(depth - 1, env), generate(depth - 1, env));
      case 3: return pair(generate(depth - 1, env), generate(depth - 1, env));
      default: { const name = `x${binder++}`; return letIn(name, generate(depth - 1, env), generate(depth - 1, [...env, name])); }
    }
  };
  let accepted = 0, rejected = 0;
  for (let i = 0; i < 2000; i++) {
    const term = generate(1 + random(5), []), w = outcome(inferW, term), j = outcome(inferJ, term);
    assert.deepEqual(w, j, `W/J reference disagreement in ${i}`);
    if (w.type) accepted++; else rejected++;
    for (const order of ['forward', 'reverse']) {
      const c = outcome(inferConstraints, term, { order });
      // Different schedules may discover different contradictions in bad terms.
      if (w.type) assert.equal(c.type, w.type, `${order}: ${i}: ${JSON.stringify(term)}`);
      else assert(c.error, `${order} accepted W-rejected case ${i}: ${JSON.stringify(term)}`);
    }
  }
  return { fixtures: fixtures.length, differential: 2000, schedules: 2, accepted, rejected, unsafeType: unsafe };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? '--check';
  if (command === '--check') console.log(JSON.stringify(check()));
  else if (command === '--trace') {
    const name = process.argv[3];
    if (name && !fixtures.some(f => f.name === name)) throw new Error(`unknown fixture ${name}`);
    for (const f of fixtures.filter(f => !name || f.name === name)) {
      console.log(`\n${f.name}: ${f.source}`);
      for (const order of ['forward', 'reverse']) {
        const trace = [];
        const result = outcome(inferConstraints, f.term, { order, trace });
        console.log(`${trace.join('\n')}\nRESULT ${JSON.stringify(result)}`);
      }
    }
  } else throw new Error('usage: node scripts/constraints.mjs --check | --trace [fixture-name]');
}
