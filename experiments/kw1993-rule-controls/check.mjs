// A bounded check of two printed statements, not a type inferencer.
// Source: KW report 93-017, dated 1 December 1993, Figures 1–3.
// Only VAR, ABS, INST-minus and GEN are checked. No APP/search/normalizer.
import assert from 'node:assert/strict';

const variable = name => ({tag:'var',name});
const arrow = (from,to) => ({tag:'arrow',from,to});
const forall = (name,body) => ({tag:'forall',name,body});
const union = (a,b) => new Set([...a,...b]);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const free = t => t.tag === 'var' ? new Set([t.name]) :
  t.tag === 'arrow' ? union(free(t.from),free(t.to)) :
  new Set([...free(t.body)].filter(x=>x!==t.name));
const envFree = env => Object.values(env).reduce((s,t)=>union(s,free(t)),new Set());
const boundNames = t => t.tag==='var' ? [] : t.tag==='arrow' ?
  [...boundNames(t.from),...boundNames(t.to)] : [t.name,...boundNames(t.body)];
function namingConvention(env,type) {
  const types=[...Object.values(env),type];
  const bound=types.flatMap(boundNames);
  const allFree=types.reduce((s,t)=>union(s,free(t)),new Set());
  return new Set(bound).size===bound.length && bound.every(x=>!allFree.has(x));
}
function alphaKey(t,stack=[]) {
  if(t.tag==='var') {
    const index=stack.lastIndexOf(t.name);
    return index<0 ? ['free',t.name] : ['bound',stack.length-1-index];
  }
  if(t.tag==='arrow') return ['arrow',alphaKey(t.from,stack),alphaKey(t.to,stack)];
  return ['forall',alphaKey(t.body,[...stack,t.name])];
}
let freshBinder=0;
function freshenResult(type,env) {
  const avoid=union(envFree(env),free(type));
  for(const t of [...Object.values(env),type]) for(const n of boundNames(t)) avoid.add(n);
  function walk(t,renaming=new Map()) {
    if(t.tag==='var') return variable(renaming.get(t.name)??t.name);
    if(t.tag==='arrow') return arrow(walk(t.from,renaming),walk(t.to,renaming));
    let name;do{name='q'+freshBinder++;}while(avoid.has(name));avoid.add(name);
    return forall(name,walk(t.body,new Map([...renaming,[t.name,name]])));
  }
  return walk(type);
}

// Rank of a type, rather than the rank of the final result alone.
function rank(t) {
  if (t.tag === 'var') return 0;
  if (t.tag === 'forall') return Math.max(1,rank(t.body));
  const input = rank(t.from);
  return Math.max(input === 0 ? 0 : input+1,rank(t.to));
}
function s0(t) { return rank(t) === 0; }
function s1(t) { while(t.tag==='forall') t=t.body; return s0(t); }
function s2(t) {
  while(t.tag==='forall') t=t.body;
  // Figure 2's normalized language permits quantifiers in parameter
  // schemes, but does not silently move positive quantifiers to the front.
  while(t.tag==='arrow') {
    if(!s1(t.from)) return false;
    t=t.to;
  }
  return t.tag==='var';
}
function admissible(env,t) { return Object.values(env).every(s1) && s2(t); }
function substitute(t,name,value) {
  if(t.tag==='var') return t.name===name ? value : t;
  if(t.tag==='arrow') return arrow(substitute(t.from,name,value),substitute(t.to,name,value));
  if(t.name===name) return t;
  // Each VAR result is alpha-renamed apart from its environment.
  // Fail instead of silently capturing a variable during instantiation.
  assert(!free(value).has(t.name),'capture avoidance needed');
  return forall(t.name,substitute(t.body,name,value));
}
const termVar = name => ({tag:'var',name});
const lambda = (name,body) => ({tag:'lambda',name,body});

// Each constructor verifies the exact premises, conclusion and side
// conditions in the selected finite rule fragment. Nothing is inferred.
const derivations=[];
function record(rule,env,term,type,children=[]) {
  assert(admissible(env,type),'assertion outside Lambda2-minus');
  assert(namingConvention(env,type),'bound/free type names clash in assertion');
  const result={rule,env,term,type,children};
  derivations.push(result);
  return result;
}
function varRule(env,name) {
  assert(env[name]);
  const result=freshenResult(env[name],env);
  assert(same(alphaKey(result),alphaKey(env[name])),'VAR requires alpha-equivalent type');
  return record('VAR',env,termVar(name),result);
}
function absRule(env,name,type,child) {
  assert(!env[name]);
  assert(same(child.env,{...env,[name]:type}));
  return record('ABS',env,lambda(name,child.term),arrow(type,child.type),[child]);
}
function instRule(env,child,value) {
  assert(same(env,child.env)); assert(child.type.tag==='forall'); assert(s0(value));
  return record('INST-minus',env,child.term,substitute(child.type.body,child.type.name,value),[child]);
}
function genRule(env,name,child) {
  assert(same(env,child.env)); assert(!envFree(env).has(name));
  assert(free(child.type).has(name),'native language excludes redundant quantifiers');
  return record('GEN',env,child.term,forall(name,child.type),[child]);
}

const a=variable('a');
const empty={};
// Native control 1: root GEN is legal, but this term has no application
// subterm at all, and therefore cannot have any companion argument.
const idBody=varRule({x:a},'x');
const id=absRule(empty,'x',a,idBody);
const polyId=genRule(empty,'a',id);
assert(same(polyId.term,lambda('x',termVar('x'))));
assert(rank(polyId.type)===1);
assert(polyId.rule==='GEN');
const applicationCount = t => t.tag==='var' ? 0 : t.tag==='lambda' ? applicationCount(t.body) : 1+applicationCount(t.fn)+applicationCount(t.arg);
const companionArgumentCount=applicationCount(polyId.term);
assert(companionArgumentCount===0);

// Native control 2: all contexts have rank-1 schemes, and every assertion
// meets the native rank-2 and S(2) gates. Distinct quantifier names preserve
// the report's freshness conventions.
const bottomX=forall('u',variable('u'));
const bottomY=forall('v',variable('v'));
const xyEnv={x:bottomX,y:bottomY};
const constantBody=instRule(xyEnv,varRule(xyEnv,'x'),a);
const inner=absRule({x:bottomX},'y',bottomY,constantBody);
const outer=absRule(empty,'x',bottomX,inner);
const closedConstant=genRule(empty,'a',outer);
assert(rank(closedConstant.type)===2);
assert(same(closedConstant.type,forall('a',arrow(bottomX,arrow(bottomY,a)))));

// In Figure 3, EVERY ABS conclusion has a forall prefix followed by
// sigma -> tau with tau in S(0). Peeling the root forall of the target
// above leaves tau = bottomY -> a, which fails that literal condition.
const requestedBody=closedConstant.type.body.to;
assert(!s0(requestedBody));
assert(s2(closedConstant.type));

// Scope controls: rank of a whole assertion includes the environment.
const higherRankInput=arrow(
  forall('b',arrow(variable('b'),variable('b'))),
  forall('c',arrow(variable('c'),variable('c')))
);
assert(rank(higherRankInput)===2);
assert(!admissible({f:higherRankInput},a));
assert(admissible({x:forall('b',arrow(variable('b'),variable('b')))},a));
assert(s0(arrow(a,a)));
assert(s1(polyId.type));
assert(!s1(higherRankInput));

const pretty = t => t.tag==='var' ? t.name : t.tag==='forall' ?
  `(forall ${t.name}. ${pretty(t.body)})` : `(${pretty(t.from)} -> ${pretty(t.to)})`;
const observations={
  source:'KW report 93-017, cover 1 December 1993',
  origin:'Lynn reconstruction',
  scope:'bounded native VAR/ABS/INST-minus/GEN derivation and grammar checks only',
  review:'not independently double-checked',
  nodesChecked:derivations.length,
  namingConventionsCheckedPerAssertion:true,
  controls:[
    {id:'root-gen',term:'lambda x. x',type:pretty(polyId.type),derivationValid:true,
     applicationSubterms:0,companionArguments:0,
     finding:'Literal Lemma4.7 omits the root exception retained by Lemma4.6.'},
    {id:'two-polymorphic-parameters',term:'lambda x. lambda y. x',type:pretty(closedConstant.type),
     derivationValid:true,assertionRank:2,contextSchemeRankAtMost:1,
     figure3AbsBodyInS0:false,
     finding:'Theorem4.9 exact-type equivalence conflicts with Figure3 literal ABS body gate; not a typability rejection of this term.'},
    {id:'rank-two-context-is-not-a-rank-two-assertion',contextType:pretty(higherRankInput),
     contextTypeRank:2,assertionAdmissible:false}
  ],
  wholeInferencer:false,authorRuntime:false,mainTheoremRechecked:false
};
console.log(JSON.stringify(observations,null,2));
