// Isolated readings of KM2007 Definition 5 and Figures 7/8/14.
// This is not W, an inference engine, or recovered author code.
import assert from 'node:assert/strict';
const checks = [];
const show = x => x === Infinity ? 'infinity' : x;
function check(id, actual, expected) {
  assert.deepEqual(actual, expected, id);
  checks.push({id, actual: show(actual), expected: show(expected)});
}
// A binding stores only the free unknowns needed by the rank definition.
// Lambda depth counts lambda bindings; scheme bindings leave it unchanged.
function foldRank(variable, context, retainPrefix) {
  let rank = Infinity, depth = 0;
  for (const binding of context) {
    if (binding.kind === 'scheme') continue;
    assert.equal(binding.kind, 'lambda');
    ++depth;
    rank = binding.free.includes(variable)
      ? Math.min(rank, depth)
      : retainPrefix ? rank : Infinity;
  }
  return rank;
}
function firstOccurrence(variable, context) {
  let depth = 0;
  for (const binding of context) {
    if (binding.kind === 'scheme') continue;
    ++depth;
    if (binding.free.includes(variable)) return depth;
  }
  return Infinity;
}
const x = {kind:'lambda', name:'x', free:['X']};
const y = {kind:'lambda', name:'y', free:['Y']};
const context = [x,y]; // Reached while checking lambda x.lambda y.x.
check('literal-single-binding', foldRank('X',[x],false), 1);
check('literal-extension-resets-earlier-rank', foldRank('X',context,false), Infinity);
check('intended-first-occurrence-survives-extension', firstOccurrence('X',context), 1);
check('candidate-retains-prefix-rank', foldRank('X',context,true), 1);
check('later-unknown-rank', foldRank('Y',context,true), 2);
check('absent-unknown-rank', foldRank('Z',context,true), Infinity);
check('scheme-binding-ignored', foldRank('X',[x,{kind:'scheme',free:['Y']}],false), 1);
check('shared-unknown-keeps-first-rank', foldRank('X',[x,{...y,free:['X']}],false), 1);
// Figure 8's limit operation, after solving X^1 = Z^2 -> R^infinity.
const variable = (name,rank) => ({tag:'variable',name,rank});
function limit(depth,type) {
  if(type.tag==='variable') return {...type,rank:Math.min(depth,type.rank)};
  assert.equal(type.tag,'arrow');
  return {...type,domain:limit(depth,type.domain),result:limit(depth,type.result)};
}
const before = {tag:'arrow',domain:variable('Z',2),result:variable('R',Infinity)};
const after = limit(1,before);
check('captured-domain-lowered', after.domain.rank, 1);
check('captured-result-lowered', after.result.rank, 1);
check('captured-domain-not-generalizable-at-depth-one', after.domain.rank>1, false);
check('captured-result-not-generalizable-at-depth-one', after.result.rank>1, false);
// Figure 14 compares m >= d at RHS depth d, before popping its marker.
// That is m > d-1 at the parent depth. Compare a contextual and a local rank.
for(const m of [0,1,2,Infinity]) {
  check('let-threshold-agreement-'+show(m), m>=1, m>0);
}
check('outer-alias-not-generalized', 0>=1, false);
check('wrong-inclusive-test-after-pop-would-generalize-alias', 0>=0, true);
console.log(JSON.stringify({
  source:'Kuan/MacQueen ML2007 corrected author copy',
  scope:'isolated definition, rank-lowering and threshold checks; no inference or author-code execution',
  checks:checks.length,
  results:checks
},null,2));
