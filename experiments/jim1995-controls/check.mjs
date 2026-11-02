// Bounded, written proof nodes for Jim TM-532 §§2–3, Examples 2/7.
// This is neither PP/MGS execution nor proof of principality or metatheory.
// Quantifier instances are supplied by each certificate; we never search.
import assert from 'node:assert/strict';
const V=name=>({tag:'v',name}),A=(from,to)=>({tag:'arrow',from,to}),I=(...parts)=>({tag:'and',parts}),Q=(names,body)=>({tag:'forall',names,body});
const variable=name=>({tag:'var',name}),lambda=(name,body)=>({tag:'lambda',name,body}),app=(fn,arg)=>({tag:'app',fn,arg}),mu=(name,body)=>({tag:'mu',name,body});
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),uniq=xs=>[...new Set(xs)];
const simple=t=>t.tag==='v'||t.tag==='arrow'&&simple(t.from)&&simple(t.to);
const components=t=>t.tag==='and'?t.parts.flatMap(components):[t];
const rank1=t=>components(t).length>0&&components(t).every(simple);
const rank2=t=>simple(t)||t.tag==='arrow'&&rank1(t.from)&&rank2(t.to);
const universal=t=>t.tag==='forall'?t.names.length>0&&universal(t.body):rank2(t);
const free=t=>t.tag==='v'?[t.name]:t.tag==='arrow'?uniq([...free(t.from),...free(t.to)]):t.tag==='and'?uniq(t.parts.flatMap(free)):free(t.body).filter(x=>!t.names.includes(x));
const envFree=g=>uniq(Object.values(g).flatMap(free));
const termFree=m=>m.tag==='var'?[m.name]:m.tag==='app'?uniq([...termFree(m.fn),...termFree(m.arg)]):termFree(m.body).filter(x=>x!==m.name);
const subst=(t,s)=>t.tag==='v'?(s[t.name]||t):t.tag==='arrow'?A(subst(t.from,s),subst(t.to,s)):t.tag==='and'?I(...t.parts.map(x=>subst(x,s))):Q(t.names,subst(t.body,Object.fromEntries(Object.entries(s).filter(([x])=>!t.names.includes(x)))));
// ≤1 is reverse set inclusion; duplicates and ordering have no effect.
const le1=(a,b)=>rank1(a)&&rank1(b)&&components(b).every(x=>components(a).some(y=>eq(x,y)));
const le2=(a,b)=>eq(a,b)||a.tag==='arrow'&&b.tag==='arrow'&&le1(b.from,a.from)&&le2(a.to,b.to);
const instance=(t,s)=>{if(t.tag!=='forall'){assert.equal(Object.keys(s).length,0);return t;}assert.deepEqual(Object.keys(s).sort(),[...t.names].sort());for(const x of Object.values(s))assert(simple(x),'instances must be T0');const out=subst(t.body,s);assert(universal(out));return out;};
// Each conjunct has its own written forall instance, the point of ≤∀2,1.
const fit=(sigma,tau,cert)=>{assert(universal(sigma)&&rank1(tau));const rhs=components(tau);assert.equal(cert.length,rhs.length);rhs.forEach((x,i)=>assert(le2(instance(sigma,cert[i]),x),'supplied instance does not meet this requirement'));};
const check=d=>{
 for(const t of Object.values(d.env))assert(rank1(t),'ordinary environment entries must be T1');assert(universal(d.type),'result must be T∀2');
 const m=d.term;
 if(d.rule==='var'){assert.equal(m.tag,'var');assert(d.env[m.name]);assert(simple(d.type)&&le1(d.env[m.name],d.type));}
 else if(d.rule==='abs'){check(d.body);assert.equal(m.tag,'lambda');assert.equal(d.type.tag,'arrow');assert(eq(m.body,d.body.term));assert(eq(d.body.type,d.type.to));assert(eq(d.body.env,{...d.env,[m.name]:d.type.from}));}
 else if(d.rule==='gen'){check(d.body);assert(eq(d.env,d.body.env)&&eq(m,d.body.term));assert.equal(d.type.tag,'forall');assert(eq(d.type.body,d.body.type));assert(d.type.names.every(x=>!envFree(d.env).includes(x)),'generalized variable escapes through the environment');}
 else if(d.rule==='sub'){check(d.body);assert(eq(d.env,d.body.env)&&eq(m,d.body.term));assert(le2(instance(d.body.type,d.instances),d.type));}
 else if(d.rule==='app'){check(d.fn);check(d.arg);assert.equal(m.tag,'app');assert(eq(m.fn,d.fn.term)&&eq(m.arg,d.arg.term));assert(eq(d.env,d.fn.env)&&eq(d.env,d.arg.env));assert.equal(d.fn.type.tag,'arrow');fit(d.arg.type,d.fn.type.from,d.instances);assert(eq(d.type,d.fn.type.to));}
 else if(d.rule==='rec-vac'){check(d.body);assert.equal(m.tag,'mu');assert(!termFree(m.body).includes(m.name));assert(eq(m.body,d.body.term)&&eq(d.env,d.body.env)&&eq(d.type,d.body.type));}
 else throw Error('unsupported written proof rule');return true;
};
const a=V('a'),b=V('b'),s=V('s'),u=V('u'),S=A(s,s),requirement=I(a,A(a,b)),env={x:requirement};
const x=variable('x'),body=app(x,x),self=lambda('x',body),id=lambda('y',variable('y'));
const fnNode={rule:'var',env,term:x,type:A(a,b)},argNode={rule:'var',env,term:x,type:a};
const bodyNode={rule:'app',env,term:body,type:b,fn:fnNode,arg:argNode,instances:[{}]};
const selfAbs={rule:'abs',env:{},term:self,type:A(requirement,b),body:bodyNode};
const selfPoly={rule:'gen',env:{},term:self,type:Q(['a','b'],selfAbs.type),body:selfAbs};
const idAbs={rule:'abs',env:{},term:id,type:A(u,u),body:{rule:'var',env:{y:u},term:variable('y'),type:u}};
const idPoly={rule:'gen',env:{},term:id,type:Q(['u'],A(u,u)),body:idAbs};
const selfInstance={rule:'sub',env:{},term:self,type:A(I(S,A(S,S)),S),body:selfPoly,instances:{a:S,b:S}};
const application={rule:'app',env:{},term:app(self,id),type:S,fn:selfInstance,arg:idPoly,instances:[{u:s},{u:S}]};
const closed={rule:'gen',env:{},term:application.term,type:Q(['s'],S),body:application};
const vacant={rule:'rec-vac',env:{},term:mu('w',self),type:selfPoly.type,body:selfPoly};
const positives={variable_function:fnNode,variable_argument:argNode,open_self_application:bodyNode,self_abstraction:selfAbs,quantified_self_abstraction:selfPoly,identity:idPoly,supplied_self_instance:selfInstance,identity_meets_two_requirements:application,closed_application:closed,vacuous_recursive_definition:vacant};
for(const d of Object.values(positives))check(d);
const negatives={
 one_identity_instance_for_both_requirements:()=>check({...application,instances:[{u:s},{u:s}]}),
 monomorphic_environment_cannot_project_argument:()=>check({...argNode,env:{x:A(a,a)}}),
 quantified_assumption_outside_T1:()=>check({...argNode,env:{x:Q(['a'],a)}}),
 quantified_arrow_domain_outside_T2:()=>check({...selfAbs,type:A(Q(['a'],a),b)}),
 generalization_captures_environment:()=>check({rule:'gen',env:{x:a},term:x,type:Q(['a'],a),body:{rule:'var',env:{x:a},term:x,type:a}}),
};
for(const run of Object.values(negatives))assert.throws(run);
console.log(JSON.stringify({boundary:'15 bounded supplied-certificate controls; no PP/MGS search, parser, author runtime or theorem recheck',positive:Object.keys(positives),negative:Object.keys(negatives),source:'Jim August1995 TM-532 §§2–3, Examples2/7 and rec-vac',nativeResults:{openBody:'x:a∧(a→b) ⊢ x x:b',self:'⊢ λx.x x:∀a,b.(a∧(a→b))→b',application:'⊢ (λx.x x)(λy.y):∀s.s→s',vacuous:'⊢ μw.λx.x x:∀a,b.(a∧(a→b))→b'},inferenceExecuted:false,proofSearch:false},null,2));
