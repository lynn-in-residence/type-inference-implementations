// Two Boolean residual identities from MLstruct2022 §3.2.1, exhaustively
// checked in a THREE-ATOM finite Boolean algebra. This is not a model of the
// full algebraic type system: its function/record laws are not set-theoretic.
// No parser, type inference, recursive constraints, or author implementation.
import assert from 'node:assert/strict';
const top=7,not=x=>top^x,sub=(x,y)=>(x&not(y))===0;
let valuations=0,identityAssertions=0;
for(let a=0;a<=top;a++)for(let b=0;b<=top;b++)for(let x=0;x<=top;x++){
 assert.equal(sub(a,b|x),sub(a&not(b),x));
 assert.equal(sub(x&b,a),sub(x,a|not(b)));
 valuations++;identityAssertions+=2;
}
const checks=[];function check(name,value,expected){assert.deepEqual(value,expected);checks.push({name,value});}
// The paper's wrong flatMap2 type lets gamma contain Some[Bool]. The Some
// branch still passes Bool to the Int-only function: union membership alone
// is insufficient. Removing ALL Some-tagged values excludes that input.
const input={tag:'Some',value:false};
const someInt=v=>v.tag==='Some'&&typeof v.value==='number';
const someBool=v=>v.tag==='Some'&&typeof v.value==='boolean';
check('wrong input union admits Some Bool',someInt(input)||someBool(input),true);
const intOnly=x=>{if(typeof x!=='number')throw Error('Int required');return x+1;};
let rejected=false;
try{intOnly(input.value);}catch(error){rejected=error.message==='Int required';}
check('wrong branch sends Bool to Int function',rejected,true);
check('negated Some tag removes wrong default input',someBool(input)&&input.tag!=='Some',false);
// §2.3.2 identifies the correlated record union with the fieldwise union.
// Compare their SET readings to expose precisely what that algebraic rule
// forgets. These sets are illustrative, not the MLstruct subtyping semantics.
const correlated=['Int/Int','Str/Str'];
const fieldwise=['Int/Int','Int/Str','Str/Int','Str/Str'];
check('set reading of record correlation has two cases',correlated.length,2);
check('fieldwise set reading has four cases',fieldwise.length,4);
check('mixed fields appear only in widened reading',!correlated.includes('Int/Str')&&fieldwise.includes('Int/Str'),true);
console.log(JSON.stringify({schema:'mlstruct2022-boolean-controls-v1',origin:'Lynn finite illustration; not double-checked',source:'MLstruct2022 author v6.2 §§1,2.3.2,3.2.1',noTermInference:true,noFullSubtypingModel:true,noAuthorExecution:true,atoms:3,valuations,identityAssertions,diagnosticAssertions:checks.length,totalAssertions:identityAssertions+checks.length,identities:['A <= B | X iff A & ~B <= X','X & B <= A iff X <= A | ~B'],checks},null,2));
