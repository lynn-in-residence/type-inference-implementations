// Isolated transcription of Figure 10's variable case and Figure 9's S-Eq
// interface. This is NOT the FreezeML solver or a term-inference implementation.
// Only variables, one nullary data constructor, and arrows are represented.
import assert from 'node:assert/strict';
const checks = [];
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
}
const variable = name => ({tag: 'var', name});
const Int = {tag: 'data', name: 'Int', arguments: []};
const arrow = (domain, range) => ({tag: 'data', name: 'arrow', arguments: [domain, range]});
function free(type) {
  return type.tag === 'var' ? [type.name] : [...new Set(type.arguments.flatMap(free))];
}
function wellFormedType(type, context, restriction) {
  if (type.tag === 'var') return type.name in context &&
    (restriction === 'poly' || context[type.name] === 'mono');
  return type.arguments.every(t => wellFormedType(t, context, restriction));
}
function identity(context) {
  return Object.fromEntries(Object.keys(context).map(a => [a, variable(a)]));
}
function apply(substitution, type) {
  // One substitution application, not chasing links: source states require
  // idempotence, so another traversal may not alter the result.
  return type.tag === 'var' ? substitution[type.name] ?? type :
    {...type, arguments: type.arguments.map(t => apply(substitution, t))};
}
function substitutionWellFormed(input, output, substitution) {
  const domain = Object.keys(substitution).sort();
  return JSON.stringify(domain) === JSON.stringify(Object.keys(input).sort()) &&
    domain.every(a => wellFormedType(substitution[a], output, input[a]));
}
function idempotent(substitution) {
  return Object.values(substitution).every(t =>
    JSON.stringify(apply(substitution, t)) === JSON.stringify(t));
}
function variableCase(context, a, type, retainSolved = false) {
  if (type.tag === 'var' && type.name === a)
    return {context: {...context}, substitution: identity(context)};
  const restriction = context[a];
  assert(restriction, 'flexible variable must be declared');
  // Pattern (Theta,a:R) excludes a from the local Theta. Demotion and the
  // assertion use this smaller context; this supplies the implicit occurs check.
  const theta1 = {...context};
  delete theta1[a];
  if (restriction === 'mono')
    for (const b of free(type)) if (b in theta1) theta1[b] = 'mono';
  assert(wellFormedType(type, theta1, restriction), 'candidate type not in scope');
  const substitution = {...identity(context), [a]: type};
  // Literal Figure 10 returns theta1, without the solved a. The optional
  // branch is only a candidate local interface adaptation AFTER the assertion.
  return {context: retainSolved ? {...theta1, [a]: restriction} : theta1, substitution};
}
function stateChecks(frameVariables, context, substitution) {
  return {
    stackDomainMatches: JSON.stringify([...frameVariables].sort()) ===
      JSON.stringify(Object.keys(context).sort()),
    substitutionDomainAndRangeMatch: substitutionWellFormed(context, context, substitution),
    idempotent: idempotent(substitution)
  };
}
const input = {a: 'poly'};
const before = stateChecks(['a'], input, identity(input));
check('initial existential state satisfies the three inspected invariants', before,
  {stackDomainMatches: true, substitutionDomainAndRangeMatch: true, idempotent: true});
const literal = variableCase(input, 'a', Int);
check('literal returned context removes a', literal.context, {});
check('literal substitution still has a in its domain', Object.keys(literal.substitution), ['a']);
check('literal substitution solves a to Int', literal.substitution.a, Int);
const after = stateChecks(['a'], literal.context, literal.substitution);
check('S-Eq keeps the existential frame, so context/stack domains differ', after.stackDomainMatches, false);
check('literal substitution is not typed from returned context to itself', after.substitutionDomainAndRangeMatch, false);
check('literal substitution is nevertheless idempotent', after.idempotent, true);
check('2020 smaller-codomain unifier interface permits this result',
  substitutionWellFormed(input, literal.context, literal.substitution), true);
const candidate = variableCase(input, 'a', Int, true);
check('candidate retains solved a after checking the type', candidate.context, input);
check('candidate restores these local state invariants',
  stateChecks(['a'], candidate.context, candidate.substitution),
  {stackDomainMatches: true, substitutionDomainAndRangeMatch: true, idempotent: true});
for (const retain of [false, true]) {
  let failed = false;
  try {variableCase(input, 'a', arrow(variable('a'), Int), retain);} catch {failed = true;}
  check(`occurs-check scope assertion fails with retainSolved=${retain}`, failed, true);
}
check('first clause a=a preserves the context', variableCase(input, 'a', variable('a')).context, input);
const demoted = variableCase({a: 'mono', b: 'poly'}, 'a', variable('b'));
check('monomorphic solve demotes b but still loses a', demoted.context, {b: 'mono'});
console.log(JSON.stringify({
  schema: 'freezeml-2022-isolated-interface-check-v1',
  scope: 'one Figure10 variable clause, reflection clause, and S-Eq context interface; not term inference or a complete solver',
  checks,
  observations: {before, literalResult: literal, afterLiteralSEq: after,
    oldUnifierInterfaceAccepts: true, candidateResult: candidate,
    candidateRestoresOnlyInspectedLocalInvariants: true, occursCheckPresent: true,
    monomorphicVariableResult: demoted},
  limits: 'No forall unification, let partitioning, general soundness/completeness/termination proof, author code execution, or implementation-review upgrade.'
}, null, 2));
