import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Dunfield–Krishnaswami 2021 §2, Figure 1's small bidirectional STLC.
// Known types contain unit and arrows only. There are no metavariables,
// polymorphic schemes, generalization, subtyping, or lambda-synthesis rule.
// This is deliberately not the authors' 2013 higher-rank algorithm.
export const unit = Object.freeze({ tag: 'unit' });
export const arrow = (from, to) => ({ tag: 'arrow', from, to });
const variable = name => ({ tag: 'var', name });
const lambda = (name, body) => ({ tag: 'lam', name, body });
const apply = (fn, arg) => ({ tag: 'app', fn, arg });
const annotate = (term, type) => ({ tag: 'ann', term, type });
const value = { tag: 'unit' };
const show = (type, left = false) => type.tag === 'unit' ? 'unit'
  : `${left ? '(' : ''}${show(type.from, true)} -> ${show(type.to)}${left ? ')' : ''}`;
const equal = (a, b) => a.tag === b.tag && (a.tag === 'unit'
  || equal(a.from, b.from) && equal(a.to, b.to));
class Failure extends Error {
  constructor(code, path, message) { super(`${message} at ${path}`); this.code = code; this.path = path; }
}
const fail = (code, path, message) => { throw new Failure(code, path, message); };
function validateType(type) {
  if (type?.tag === 'unit') return;
  if (type?.tag === 'arrow') { validateType(type.from); validateType(type.to); return; }
  fail('invalid-type', 'type', 'only unit and arrow types belong to this demo');
}
function engine(context, trace) {
  const env = new Map(context);
  for (const type of env.values()) validateType(type);
  const log = (depth, text) => trace.push(`${'  '.repeat(depth)}${text}`);
  const synth = (term, ctx, path, depth) => {
    log(depth, `synth ${path} (${term.tag})`);
    let result;
    switch (term.tag) {
      case 'var':
        if (!ctx.has(term.name)) fail('unbound-variable', path, `unknown variable ${term.name}`);
        log(depth + 1, `Var: look up ${term.name}`);
        result = ctx.get(term.name); break;
      case 'ann':
        validateType(term.type);
        log(depth + 1, 'Anno: use the written type to check the enclosed term');
        check(term.term, term.type, ctx, `${path}.term`, depth + 1);
        result = term.type; break;
      case 'app': {
        log(depth + 1, 'App: synthesize the function before checking its argument');
        const fnType = synth(term.fn, ctx, `${path}.fn`, depth + 1);
        if (fnType.tag !== 'arrow') fail('not-a-function', `${path}.fn`, 'application needs an arrow');
        check(term.arg, fnType.from, ctx, `${path}.arg`, depth + 1);
        result = fnType.to; break;
      }
      case 'unit': case 'lam':
        fail('cannot-synthesize', path, `${term.tag} has a checking rule but no synthesis rule here`);
        break;
      default: throw new Error(`unknown term tag ${term.tag}`);
    }
    log(depth, `result ${path}: ${show(result)}`);
    return result;
  };
  const check = (term, expected, ctx, path, depth) => {
    log(depth, `check ${path} (${term.tag}) against ${show(expected)}`);
    if (term.tag === 'lam') {
      if (expected.tag !== 'arrow') fail('type-mismatch', path, 'lambda needs an expected arrow');
      log(depth + 1, `Lam: bind ${term.name} : ${show(expected.from)}; check the body against ${show(expected.to)}`);
      const bodyEnv = new Map(ctx); bodyEnv.set(term.name, expected.from);
      check(term.body, expected.to, bodyEnv, `${path}.body`, depth + 1);
    } else if (term.tag === 'unit') {
      if (expected.tag !== 'unit') fail('type-mismatch', path, 'unit value needs expected unit');
      log(depth + 1, 'Unit: expected unit matches');
    } else {
      // Figure 1 Sub⇐: synthesize, then compare by exact structural equality.
      // Applying this as the fallback preserves expected types for lambdas.
      log(depth + 1, 'Switch: synthesize, then compare with the expected type');
      const actual = synth(term, ctx, path, depth + 1);
      if (!equal(actual, expected)) fail('type-mismatch', path, `got ${show(actual)}, expected ${show(expected)}`);
    }
    log(depth, `checked ${path}`);
  };
  return { synth: term => synth(term, env, 'root', 0), check: (term, expected) => check(term, expected, env, 'root', 0) };
}
export function synthesize(term, context = new Map(), trace = []) {
  return show(engine(context, trace).synth(term));
}
export function checkAgainst(term, expected, context = new Map(), trace = []) {
  validateType(expected); engine(context, trace).check(term, expected); return true;
}

const id = lambda('x', variable('x'));
const endo = arrow(unit, unit);
const higher = arrow(endo, unit);
export const fixtures = [
  { name: 'identity-check', source: 'fun x -> x', term: id, expected: endo },
  { name: 'identity-synth', source: 'fun x -> x', term: id, error: 'cannot-synthesize' },
  { name: 'unit-check', source: '()', term: value, expected: unit },
  { name: 'unit-synth', source: '()', term: value, error: 'cannot-synthesize' },
  { name: 'variable-synth', source: 'x', term: variable('x'), context: [['x', endo]], result: 'unit -> unit' },
  { name: 'argument-check', source: 'f (fun x -> x)', term: apply(variable('f'), id), context: [['f', higher]], result: 'unit' },
  { name: 'redex', source: '(fun x -> x) ()', term: apply(id, value), error: 'cannot-synthesize' },
  { name: 'annotated-function', source: '((fun x -> x) : unit -> unit) ()', term: apply(annotate(id, endo), value), result: 'unit' },
  { name: 'outer-annotation', source: '(((fun x -> x) ()) : unit)', term: annotate(apply(id, value), unit), error: 'cannot-synthesize' },
  { name: 'annotated-identity', source: '((fun x -> x) : unit -> unit)', term: annotate(id, endo), result: 'unit -> unit' },
  { name: 'wrong-argument', source: 'f ()', term: apply(variable('f'), value), context: [['f', higher]], error: 'type-mismatch' },
  { name: 'not-a-function', source: 'u ()', term: apply(variable('u'), value), context: [['u', unit]], error: 'not-a-function' },
  { name: 'unknown-variable', source: 'missing', term: variable('missing'), error: 'unbound-variable' },
  { name: 'shadowing', source: 'fun x -> x (outer x has type unit -> unit)', term: id, context: [['x', endo]], expected: endo },
  { name: 'constant-function', source: 'fun x -> ()', term: lambda('x', value), expected: higher },
  { name: 'wrong-result', source: 'fun x -> ()', term: lambda('x', value), expected: arrow(unit, endo), error: 'type-mismatch' }
];
function run(f, trace = []) {
  const ctx = new Map(f.context ?? []);
  try { return f.expected ? { checked: checkAgainst(f.term, f.expected, ctx, trace) } : { type: synthesize(f.term, ctx, trace) }; }
  catch (error) {
    if (!(error instanceof Failure)) throw error;
    return { error: error.code, path: error.path };
  }
}
export function check() {
  for (const f of fixtures) {
    const result = run(f);
    assert.deepEqual(result.error ? { error: result.error } : result,
      f.error ? { error: f.error } : f.expected ? { checked: true } : { type: f.result }, f.name);
  }
  const ctx = new Map([['x', endo]]);
  checkAgainst(id, endo, ctx);
  assert.equal(synthesize(variable('x'), ctx), 'unit -> unit', 'checking must not mutate the caller context');
  assert.throws(() => checkAgainst(id, { tag: 'forall' }), error => error.code === 'invalid-type');
  return { fixtures: fixtures.length, invariants: ['context isolation', 'type grammar'], scope: 'survey 2021 §2 STLC; not DK 2013' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? '--check';
  if (command === '--check') console.log(JSON.stringify(check()));
  else if (command === '--trace') {
    const name = process.argv[3];
    if (name && !fixtures.some(f => f.name === name)) throw new Error(`unknown fixture ${name}`);
    for (const f of fixtures.filter(f => !name || f.name === name)) {
      const trace = [];
      console.log(`\n${f.name}: ${f.source}${f.expected ? ` [check ${show(f.expected)}]` : ' [synthesize]'}`);
      const result = run(f, trace);
      console.log(`${trace.join('\n')}\nRESULT ${JSON.stringify(result)}`);
    }
  } else throw new Error('usage: --check | --trace [fixture-name]');
}
