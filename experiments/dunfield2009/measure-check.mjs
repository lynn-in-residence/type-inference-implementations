// Exact finite witness for §3.5(ii), not an inference implementation.
import assert from 'node:assert/strict';
const one={tag:'unit'},variable=name=>({tag:'var',name}),arrow=(a,b)=>({tag:'arrow',a,b});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// This witness has no existential variables, so the renaming clause is idle.
const below=(a,b)=>b.tag==='arrow'&&(same(a,b.a)||same(a,b.b)||below(a,b.a)||below(a,b.b));
const pairBelow=(xs,ys)=>xs.every(x=>ys.every(y=>!below(y,x)))&&xs.some(x=>ys.some(y=>below(x,y)));
const a=variable('a'),b=variable('b'),c=variable('c');
const P=[one,a],Q=[arrow(one,one),b],R=[c,arrow(b,b)];
assert(pairBelow(P,Q));assert(pairBelow(Q,R));assert(!pairBelow(P,R));
console.log(JSON.stringify({scope:'three comparisons in the printed pair ordering',P_below_Q:true,Q_below_R:true,P_below_R:false,transitive:false,inferenceExecuted:false}));
