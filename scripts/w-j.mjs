import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Two deliberately small HM engines. Shared code handles syntax, printing and
// tests; each engine owns its unification and environment/substitution logic.
// This is teaching code, not an implementation of all of Milner's Exp language.
const variable = name => ({ tag: 'var', name });
const lambda = (name, body) => ({ tag: 'lam', name, body });
const apply = (fn, arg) => ({ tag: 'app', fn, arg });
const letIn = (name, value, body) => ({ tag: 'let', name, value, body });
const pair = (left, right) => ({ tag: 'pair', left, right });
const int = { tag: 'int' }, bool = { tag: 'bool' };
const con = (name, ...args) => ({ tag: 'con', name, args });
const arrow = (input, output) => con('arrow', input, output);
const product = (left, right) => con('product', left, right);
const mono = type => ({ quantified: new Set(), type });
const extend = (env, name, scheme) => new Map([...env, [name, scheme]]);
const union = (...sets) => new Set(sets.flatMap(s => [...s]));
const minus = (left, right) => new Set([...left].filter(x => !right.has(x)));

class InferenceError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// Stable alpha-normalization only for comparison/output. Traces instead retain
// fresh-variable IDs so that two independently instantiated calls stay visible.
function show(type, resolve = t => t, canonical = true) {
  const names = new Map();
  const go = (original, precedence = 0) => {
    const t = resolve(original);
    if (t.tag === 'var') {
      if (!canonical) return `t${t.id}`;
      if (!names.has(t.id)) {
        const n = names.size;
        names.set(t.id, n < 26 ? String.fromCharCode(97 + n) : `a${n}`);
      }
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
}

export function inferW(term, trace = []) {
  let next = 0;
  const fresh = () => ({ tag: 'var', id: next++ });
  // W's type nodes never mutate. A substitution is a separately returned map.
  const substitute = (s, t) => t.tag === 'var'
    ? (s.has(t.id) ? substitute(s, s.get(t.id)) : t)
    : con(t.name, ...t.args.map(a => substitute(s, a)));
  const ftv = t => t.tag === 'var' ? new Set([t.id]) : union(...t.args.map(ftv));
  const envFtv = env => union(...[...env.values()].map(s => minus(ftv(s.type), s.quantified)));
  const substEnv = (s, env) => new Map([...env].map(([name, scheme]) => {
    const available = new Map([...s].filter(([id]) => !scheme.quantified.has(id)));
    return [name, { ...scheme, type: substitute(available, scheme.type) }];
  }));
  // compose(after,before) denotes after(before(t)), including in old ranges.
  const compose = (after, before) => new Map([
    ...after, ...[...before].map(([id, t]) => [id, substitute(after, t)])
  ]);
  const unify = (left, right) => {
    trace.push(`W unify ${show(left, undefined, false)} = ${show(right, undefined, false)}`);
    if (left.tag === 'var') {
      if (right.tag === 'var' && left.id === right.id) return new Map();
      if (ftv(right).has(left.id)) throw new InferenceError('occurs-check');
      trace.push(`W return substitution t${left.id} := ${show(right, undefined, false)}`);
      return new Map([[left.id, right]]);
    }
    if (right.tag === 'var') return unify(right, left);
    if (left.name !== right.name || left.args.length !== right.args.length)
      throw new InferenceError('constructor-clash');
    let s = new Map();
    for (let i = 0; i < left.args.length; i++) {
      const u = unify(substitute(s, left.args[i]), substitute(s, right.args[i]));
      s = compose(u, s);
    }
    return s;
  };
  const instantiate = (name, scheme) => {
    const replacements = new Map([...scheme.quantified].map(id => [id, fresh()]));
    const result = substitute(replacements, scheme.type);
    trace.push(`W use ${name}: ${show(result, undefined, false)}`);
    return result;
  };
  const infer = (env, e) => {
    switch (e.tag) {
      case 'int': return [new Map(), con('Int')];
      case 'bool': return [new Map(), con('Bool')];
      case 'var': {
        if (!env.has(e.name)) throw new InferenceError('unbound-variable');
        return [new Map(), instantiate(e.name, env.get(e.name))];
      }
      case 'lam': {
        const parameter = fresh();
        const [s, body] = infer(extend(env, e.name, mono(parameter)), e.body);
        return [s, arrow(substitute(s, parameter), body)];
      }
      case 'app': {
        const [r, fn] = infer(env, e.fn);
        const [s, arg] = infer(substEnv(r, env), e.arg);
        const result = fresh();
        const u = unify(substitute(s, fn), arrow(arg, result));
        return [compose(u, compose(s, r)), substitute(u, result)];
      }
      case 'pair': {
        const [r, left] = infer(env, e.left);
        const [s, right] = infer(substEnv(r, env), e.right);
        return [compose(s, r), product(substitute(s, left), right)];
      }
      case 'let': {
        const [r, value] = infer(env, e.value);
        const solvedEnv = substEnv(r, env);
        const quantified = minus(ftv(value), envFtv(solvedEnv));
        trace.push(`W generalize ${e.name}: {${[...quantified].map(id => `t${id}`).join(', ')}}`);
        const [s, body] = infer(extend(solvedEnv, e.name, { quantified, type: value }), e.body);
        return [compose(s, r), body];
      }
      default: throw new Error(`unknown syntax ${e.tag}`);
    }
  };
  const [s, type] = infer(new Map(), term);
  return show(substitute(s, type));
}

export function inferJ(term, trace = []) {
  let next = 0;
  const fresh = () => ({ tag: 'var', id: next++, link: null });
  // A mutable link graph represents J's global substitution implicitly.
  // Following links exposes solved types; no immutable W map is reused here.
  const resolve = t => {
    if (t.tag !== 'var' || !t.link) return t;
    t.link = resolve(t.link); // path compression preserves the represented type
    return t.link;
  };
  const ftv = original => {
    const t = resolve(original);
    return t.tag === 'var' ? new Set([t.id]) : union(...t.args.map(ftv));
  };
  const envFtv = env => union(...[...env.values()].map(s => minus(ftv(s.type), s.quantified)));
  const unify = (a, b) => {
    const left = resolve(a), right = resolve(b);
    trace.push(`J unify ${show(left, resolve, false)} = ${show(right, resolve, false)}`);
    if (left.tag === 'var') {
      if (right.tag === 'var' && left.id === right.id) return;
      if (ftv(right).has(left.id)) throw new InferenceError('occurs-check');
      trace.push(`J set link t${left.id} := ${show(right, resolve, false)}`);
      left.link = right;
      return;
    }
    if (right.tag === 'var') return unify(right, left);
    if (left.name !== right.name || left.args.length !== right.args.length)
      throw new InferenceError('constructor-clash');
    left.args.forEach((t, i) => unify(t, right.args[i]));
  };
  const instantiate = (name, scheme) => {
    const replacements = new Map();
    const copy = original => {
      const t = resolve(original);
      if (t.tag === 'var') {
        if (!scheme.quantified.has(t.id)) return t; // shared monomorphic unknown
        if (!replacements.has(t.id)) replacements.set(t.id, fresh());
        return replacements.get(t.id);
      }
      return con(t.name, ...t.args.map(copy));
    };
    const result = copy(scheme.type);
    trace.push(`J use ${name}: ${show(result, resolve, false)}`);
    return result;
  };
  const infer = (env, e) => {
    switch (e.tag) {
      case 'int': return con('Int');
      case 'bool': return con('Bool');
      case 'var': {
        if (!env.has(e.name)) throw new InferenceError('unbound-variable');
        return instantiate(e.name, env.get(e.name));
      }
      case 'lam': {
        const parameter = fresh();
        return arrow(parameter, infer(extend(env, e.name, mono(parameter)), e.body));
      }
      case 'app': {
        const fn = infer(env, e.fn), arg = infer(env, e.arg), result = fresh();
        unify(fn, arrow(arg, result));
        return result;
      }
      case 'pair': return product(infer(env, e.left), infer(env, e.right));
      case 'let': {
        const value = infer(env, e.value);
        const quantified = minus(ftv(value), envFtv(env));
        trace.push(`J generalize ${e.name}: {${[...quantified].map(id => `t${id}`).join(', ')}}`);
        return infer(extend(env, e.name, { quantified, type: value }), e.body);
      }
      default: throw new Error(`unknown syntax ${e.tag}`);
    }
  };
  return show(infer(new Map(), term), resolve);
}

const x = variable('x'), f = variable('f'), id = variable('id');
export const fixtures = [
  { name: 'let-polymorphism', source: 'let id = fun x -> x in (id 1, id true)',
    term: letIn('id', lambda('x', x), pair(apply(id, int), apply(id, bool))), expected: '(Int * Bool)' },
  { name: 'captured-alias', source: 'fun x -> let alias = x in (alias 1, alias true)',
    term: lambda('x', letIn('alias', x, pair(apply(variable('alias'), int), apply(variable('alias'), bool)))), error: 'constructor-clash' },
  { name: 'application', source: 'fun f -> fun x -> f x',
    term: lambda('f', lambda('x', apply(f, x))), expected: '(a -> b) -> a -> b' },
  { name: 'self-application', source: 'fun x -> x x',
    term: lambda('x', apply(x, x)), error: 'occurs-check' },
  { name: 'hostile-term', source: 'let id = fun x -> x in (fun f -> (f 123, f true)) id',
    term: letIn('id', lambda('x', x), apply(lambda('f', pair(apply(f, int), apply(f, bool))), id)), error: 'constructor-clash' },
  { name: 'same-parameter', source: 'fun x -> (x, x)',
    term: lambda('x', pair(x, x)), expected: 'a -> (a * a)' },
  { name: 'fresh-let-uses', source: 'let id = fun x -> x in (id, id)',
    term: letIn('id', lambda('x', x), pair(id, id)), expected: '((a -> a) * (b -> b))' },
  { name: 'shadowing', source: 'let x = 1 in let x = true in x',
    term: letIn('x', int, letIn('x', bool, x)), expected: 'Bool' },
  { name: 'solved-environment', source: 'fun f -> let y = f 1 in (y, f true)',
    term: lambda('f', letIn('y', apply(f, int), pair(variable('y'), apply(f, bool)))), error: 'constructor-clash' },
  { name: 'shared-result', source: 'fun f -> let y = f 1 in (y, y)',
    term: lambda('f', letIn('y', apply(f, int), pair(variable('y'), variable('y')))), expected: '(Int -> a) -> (a * a)' },
  { name: 'propagated-pair', source: 'fun f -> (f, f 1)',
    term: lambda('f', pair(f, apply(f, int))), expected: '(Int -> a) -> ((Int -> a) * a)' },
  { name: 'captured-and-generic', source: 'fun x -> let k = fun y -> x in (k 1, k true)',
    term: lambda('x', letIn('k', lambda('y', x), pair(apply(variable('k'), int), apply(variable('k'), bool)))), expected: 'a -> (a * a)' }
];

function outcome(engine, term, trace = []) {
  try { return { type: engine(term, trace) }; }
  catch (error) {
    if (!(error instanceof InferenceError)) throw error; // never swallow code bugs
    return { error: error.code };
  }
}

export function check() {
  for (const fixture of fixtures) {
    const expected = fixture.error ? { error: fixture.error } : { type: fixture.expected };
    assert.deepEqual(outcome(inferW, fixture.term), expected, `W ${fixture.name}`);
    assert.deepEqual(outcome(inferJ, fixture.term), expected, `J ${fixture.name}`);
  }
  // Closed random ASTs are differential regressions, not a metatheory proof.
  // Fixed seed makes failures replayable. Keep depth bounded, including occurs
  // checks, and demand equal failure reasons as well as alpha-normalized types.
  let state = 0x574a2026, binder = 0;
  const random = n => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 0x100000000) * n);
  };
  const generate = (depth, env) => {
    if (!depth) return env.length && random(3) === 0 ? variable(env[random(env.length)]) : random(2) ? int : bool;
    switch (random(6)) {
      case 0: return generate(0, env);
      case 1: {
        const name = `x${binder++}`;
        return lambda(name, generate(depth - 1, [...env, name]));
      }
      case 2: return apply(generate(depth - 1, env), generate(depth - 1, env));
      case 3: return pair(generate(depth - 1, env), generate(depth - 1, env));
      default: {
        const name = `x${binder++}`;
        return letIn(name, generate(depth - 1, env), generate(depth - 1, [...env, name]));
      }
    }
  };
  let accepted = 0;
  for (let i = 0; i < 2000; i++) {
    const term = generate(1 + random(5), []);
    const w = outcome(inferW, term), j = outcome(inferJ, term);
    assert.deepEqual(w, j, `generated case ${i}: ${JSON.stringify(term)}`);
    if (w.type) accepted++;
  }
  return { fixtures: fixtures.length, differential: 2000, accepted, rejected: 2000 - accepted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? '--check';
  if (command === '--check') console.log(JSON.stringify(check()));
  else if (command === '--trace') {
    const selected = process.argv[3];
    if (selected && !fixtures.some(f => f.name === selected)) throw new Error(`unknown fixture ${selected}`);
    for (const fixture of fixtures.filter(f => !selected || f.name === selected)) {
      console.log(`\n${fixture.name}: ${fixture.source}`);
      for (const [name, engine] of [['W', inferW], ['J', inferJ]]) {
        const trace = [];
        const result = outcome(engine, fixture.term, trace);
        console.log(`${name}: ${JSON.stringify(result)}\n${trace.join('\n')}`);
      }
    }
  } else throw new Error('usage: node scripts/w-j.mjs --check | --trace [fixture-name]');
}
