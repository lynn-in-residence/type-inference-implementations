// Source-local accounting and one substitution proof-line control.
// LC CS-2006-08 revised 27 July 2007, §§4.1/5; not an inferencer.
import assert from 'node:assert/strict';

function enumerate(m,p,n) {
  const chains=[];
  for(let j=0;j<m;j++) chains.push(Array.from({length:n+1},(_,i)=>`x${j}@${i}`));
  for(let j=0;j<p;j++) chains.push(Array.from({length:n+1},(_,i)=>`w${j}@${i}`));
  for(let j=1;j<=n;j++) chains.push(Array.from({length:n-j+1},(_,i)=>`y${j}@${j+i}`));
  const kwBeta=chains.flat().length, lcBeta=chains.length;
  const links=chains.reduce((sum,c)=>sum+c.length-1,0);
  assert.equal(kwBeta,(m+p)*(n+1)+n*(n+1)/2);
  assert.equal(lcBeta,m+p+n);
  assert.equal(links,(m+p)*n+n*(n-1)/2);
  assert.equal(kwBeta-lcBeta,links);
  return {m,p,n,kwBeta,lcBeta,removedChainLinks:links};
}
let accountingCases=0;
for(const m of [0,1,3]) for(const p of [0,1,2]) for(const n of [0,1,2,3,4,8,16,64]) {
  enumerate(m,p,n);accountingCases++;
}

// Ordinary simultaneous substitution: replacing a variable returns its
// image once. It does not recursively chase images inside the same map.
const apply=(name,s)=>s[name]??name;
const S={a:'b',b:'c'}, SC={a:'b'}, SCPrime={b:'c'}, local={c:'b'};
assert.equal(apply(apply('b',S),local),apply('a',S),'Gamma={b<=a} premise');
assert.equal(apply('a',S),'b');
assert.equal(apply(apply('a',SC),SCPrime),'c');
assert.equal(apply(apply('a',SCPrime),SC),'b');
assert.notEqual(apply(apply('a',SC),SCPrime),apply('a',S));
assert(!Object.keys(SC).some(k=>Object.hasOwn(SCPrime,k)));
assert.notEqual(apply(apply('a',S),S),apply('a',S),'S is not idempotent');

console.log(JSON.stringify({
  source:'LC CS-2006-08 revised 27 July 2007',
  origin:'Lynn reconstruction',review:'not independently double-checked',
  scope:'finite staged-variable/link accounting and ordinary simultaneous substitutions',
  accountingCases,examples:[enumerate(1,0,3),enumerate(1,0,64)],
  substitutionControl:{instance:'b <= a',S,local,premiseHolds:true,
    domainsDisjoint:true,simultaneousImageOfA:'b',SCThenSCPrime:'c',SCPrimeThenSC:'b',
    commute:false,printedRestrictionFactorization:false,idempotent:false,
    finding:'Disjoint domains alone do not justify the printed Theorem5 proof line; no theorem or algorithm refutation.'},
  wholeInferencer:false,authorRuntime:false,metatheoremRechecked:false
},null,2));
