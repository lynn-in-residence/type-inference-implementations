// Two source-local proof controls for Mitchell JFP1991 pp.280/282.
// One-step substitution and printed metric, not a unifier or typing algorithm.
import assert from 'node:assert/strict';
const v=name=>({tag:'var',name}),arrow=(left,right)=>({tag:'arrow',left,right});
// Simultaneous substitution: do not re-apply a map to its substituted output.
const apply=(s,t)=>t.tag==='var'?(s[t.name]||t):arrow(apply(s,t.left),apply(s,t.right));
const compose=(s,t,x)=>apply(s,apply(t,x)); // source §5.2: (S∘T)x = S(Tx)
const occurrences=t=>t.tag==='var'?[t.name]:[...occurrences(t.left),...occurrences(t.right)];
const arrows=t=>t.tag==='var'?0:1+arrows(t.left)+arrows(t.right);
const eqDegree=eqs=>[eqs.reduce((n,[a,b])=>n+arrows(a)+arrows(b),0),eqs.length];
const less=([a,b],[c,d])=>a<c||(a===c&&b<d);
// Implement exactly the legal variable-elimination step, without recursion.
const eliminate=(eqs,name,rhs)=>{
 assert(!occurrences(rhs).includes(name),'printed occurs side condition');
 const [head,...rest]=eqs;assert.deepEqual(head,[v(name),rhs]);
 return rest.map(([a,b])=>[apply({[name]:rhs},a),apply({[name]:rhs},b)]);
};
const rows=[];
for(let depth=1;depth<=3;depth++)for(let copies=1;copies<=3;copies++){
 let rhs=v('s');for(let i=0;i<depth;i++)rhs=arrow(v('s'),rhs);
 const input=[[v('t'),rhs],...Array.from({length:copies},(_,i)=>[v('t'),v('u'+i)])];
 const output=eliminate(input,'t',rhs),before=eqDegree(input),after=eqDegree(output);
 assert.deepEqual(before,[depth,copies+1]);assert.deepEqual(after,[depth*copies,copies]);
 assert.equal(less(after,before),copies===1);
 rows.push({rhsArrowOccurrences:depth,remainingCopies:copies,before,after,printedDegreeDecreases:less(after,before)});
}
// Concrete printed Lemma30 antecedents, including T's unconstrained action on V.
const V=['a','b'],S={a:v('x'),b:v('y')},T={x:v('u'),y:v('v'),a:v('z'),b:v('z')};
const chooseFreely=(roots,image)=>{const names=roots.flatMap(x=>occurrences(image(v(x))));return new Set(names).size===names.length;};
const range=[...new Set(V.flatMap(x=>occurrences(apply(S,v(x)))))];
assert(chooseFreely(V,x=>apply(S,x)));assert(chooseFreely(range,x=>apply(T,x)));
const printed=V.map(x=>compose(S,T,v(x))),reversed=V.map(x=>compose(T,S,v(x)));
assert.deepEqual(printed,[v('z'),v('z')]);assert.deepEqual(reversed,[v('u'),v('v')]);
assert(!chooseFreely(V,x=>compose(S,T,x)));assert(chooseFreely(V,x=>compose(T,S,x)));
console.log(JSON.stringify({boundary:'9 one-step metric controls and 1 finite composition counterexample; no UNIFY/MATCH/G/GA execution',source:'Mitchell JFP1991 §5.2 composition; Appendix Lemmas27/30, pp280/282',lemma27:{cases:rows,concrete:{input:'{t=s→s,t=u,t=v}',output:'{s→s=u,s→s=v}',before:[1,3],after:[2,2]}},lemma30:{V,S:{a:'x',b:'y'},T:{x:'u',y:'v',a:'z',b:'z'},SChoosesFreely:true,TChoosesFreelyOnSRange:true,printedSAfterT:['z','z'],printedConclusion:false,reverseTAfterS:['u','v'],reverseChoosesFreely:true},typingInferenceExecuted:false,unificationExecuted:false,theoremRecheck:false},null,2));
