// Bounded transcription of §3.3's coalescer for three hand-built states, plus
// symbolic index routing in two arrow examples. No term inference, subtype
// oracle, extrusion implementation, simplifier, or theorem checker.
import assert from 'node:assert/strict';
let assertions=0;
function eq(a,b){assert.deepEqual(a,b);assertions++;}
const variable=name=>({kind:'var',name});
const fun=(left,right)=>({kind:'fun',left,right});
const binary=(kind,left,right)=>({kind,left,right});
const state=name=>({name,lower:[],upper:[]});
const ref=state=>({kind:'ref',state});
function coalesce(root){
 const recursive=new Map(),trace=[];
 function go(ty,positive,inProcess){
  if(ty.kind==='primitive')return {...ty};
  if(ty.kind==='fun')return fun(go(ty.left,!positive,inProcess),go(ty.right,positive,inProcess));
  if(ty.kind==='record')return {kind:'record',fields:ty.fields.map(([name,t])=>[name,go(t,positive,inProcess)])};
  assert.equal(ty.kind,'ref');const vs=ty.state,key=vs.name+':'+(positive?'+':'-');
  if(inProcess.has(key)){
   if(!recursive.has(key))recursive.set(key,'rec_'+vs.name+'_'+(positive?'pos':'neg'));
   trace.push({variable:vs.name,polarity:positive?'+':'-',action:'recursive-reference'});
   return variable(recursive.get(key));
  }
  const bounds=positive?vs.lower:vs.upper;
  trace.push({variable:vs.name,polarity:positive?'+':'-',bounds:positive?'lower':'upper',count:bounds.length});
  const visited=new Set(inProcess);visited.add(key);
  const boundTypes=bounds.map(t=>go(t,positive,visited));
  const body=boundTypes.reduce((a,b)=>binary(positive?'union':'meet',a,b),variable(vs.name));
  return recursive.has(key)?{kind:'mu',name:recursive.get(key),body}:body;
 }
 return {type:go(root,true,new Set()),trace};
}
function render(t){
 if(t.kind==='var'||t.kind==='primitive')return t.name;
 if(t.kind==='fun')return '('+render(t.left)+' -> '+render(t.right)+')';
 if(t.kind==='union'||t.kind==='meet')return '('+render(t.left)+(t.kind==='union'?' | ':' & ')+render(t.right)+')';
 if(t.kind==='mu')return '(mu '+t.name+'. '+render(t.body)+')';
 return '{'+t.fields.map(([n,t])=>n+': '+render(t)).join('; ')+'}';
}
// The literal state in printed p.124:14 has ONLY a cyclic upper bound on t.
const s=state('s'),t=state('t');t.upper=[fun(ref(s),ref(t))];
const literal=coalesce(fun(ref(s),ref(t)));
eq(literal.type,fun(variable('s'),variable('t')));
eq(literal.trace,[{variable:'s',polarity:'-',bounds:'upper',count:0},{variable:'t',polarity:'+',bounds:'lower',count:0}]);
// The same upper-bound cycle IS reached when t is put in negative position.
const negative=coalesce(fun(ref(t),ref(s)));
eq(negative.type.left.kind,'mu');
eq(negative.type.left.name,'rec_t_neg');
eq(negative.type.left.body,binary('meet',variable('t'),fun(variable('s'),variable('rec_t_neg'))));
// Moving that cycle to lower bounds gives a candidate corrected state.
// The free t seed still appears: eliminating it needs a separate simplifier.
const s2=state('s'),t2=state('t');t2.lower=[fun(ref(s2),ref(t2))];
const lower=coalesce(fun(ref(s2),ref(t2)));
eq(lower.type.right.kind,'mu');
eq(lower.type.right.name,'rec_t_pos');
eq(lower.type.right.body,binary('union',variable('t'),fun(variable('s'),variable('rec_t_pos'))));
eq(lower.type.left,variable('s'));
// Route four distinct symbols through the constructor-merging equation used
// by §4.1. This checks indices, not semantic subtyping or arbitrary equivalence.
const [a,b,c,d]=['tau0','tau1','tau2','tau3'].map(variable);
const correct=fun(binary('union',a,c),binary('meet',b,d));
const page23=fun(binary('union',a,c),binary('meet',b,c));
const page24=fun(binary('union',a,b),binary('meet',c,d));
eq(correct.left,binary('union',a,c));eq(correct.right,binary('meet',b,d));
eq(page23.left,correct.left);eq(JSON.stringify(page23.right)===JSON.stringify(correct.right),false);
eq(JSON.stringify(page24.left)===JSON.stringify(correct.left),false);eq(JSON.stringify(page24.right)===JSON.stringify(correct.right),false);
// Also verify whole symbolic AST inequality.
eq(JSON.stringify(page23)===JSON.stringify(correct),false);
eq(JSON.stringify(page24)===JSON.stringify(correct),false);
const evaluation={printedTotal:1313832,wellTyped:515509,illTyped:798321};
eq(evaluation.wellTyped+evaluation.illTyped,1313830);
console.log(JSON.stringify({scope:'Three hand-built coalescing states and two symbolic constructor-index checks; no term inference or theorem validation',assertions,coalescing:{literalUpperCycle:{rendered:render(literal.type),...literal},negativePositionControl:{rendered:render(negative.type),...negative},candidateLowerCycle:{rendered:render(lower.type),...lower}},arrowRouting:{correct:render(correct),printedPage23:render(page23),printedPage24:render(page24)},evaluation:{...evaluation,countDifference:evaluation.printedTotal-evaluation.wellTyped-evaluation.illTyped}},null,2));
