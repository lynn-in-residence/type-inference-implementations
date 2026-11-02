// Native typed-spine/subtyping controls for Mercer–Ramsay–Krishnaswami2022.
// Lynn's reconstruction of Figures9/11; not author code, not double-checked.
// No term parser, lambda-parameter inference, term evaluation, or v2 adapter.
import assert from 'node:assert/strict';
const v=name=>({tag:'var',name}),ev=name=>({tag:'ev',name});
const down=body=>({tag:'down',body}),up=body=>({tag:'up',body});
const arrow=(domain,body)=>({tag:'arrow',domain,body});
const all=(name,body)=>({tag:'forall',name,body});
const rigid=name=>({tag:'rigid',name}),guess=name=>({tag:'guess',name});
const children=t=>t.tag==='arrow'?[t.domain,t.body]:t.body?[t.body]:[];
function free(t,kind='var',bound=new Set()){
 if(t.tag===kind)return new Set(bound.has(t.name)?[]:[t.name]);
 const next=t.tag==='forall'&&kind==='var'?new Set([...bound,t.name]):bound;
 return new Set(children(t).flatMap(x=>[...free(x,kind,next)]));
}
const ground=t=>free(t,'ev').size===0;
function pretty(t){switch(t.tag){case'var':return t.name;case'ev':return '?'+t.name;case'down':return '↓('+pretty(t.body)+')';case'up':return '↑('+pretty(t.body)+')';case'forall':return '∀'+t.name+'.'+pretty(t.body);case'arrow':return '('+pretty(t.domain)+'→'+pretty(t.body)+')';}}
class Controls{
 constructor(ctx=[],inputs=[]){this.ctx=structuredClone(ctx);this.used=new Set(ctx.map(x=>x.name));for(const t of inputs)this.names(t);this.counter=0;this.fuel=4096;}
 names(t){if(t.name)this.used.add(t.name);for(const c of children(t))this.names(c);}
 fresh(prefix){let n;do{n=prefix+this.counter++;}while(this.used.has(n));this.used.add(n);return n;}
 step(){if(--this.fuel<0)throw Error('control fuel exceeded; no general termination claim');}
 subst(t,name,p){
  if(t.tag==='var')return t.name===name?p:t;
  if(t.tag==='forall'){
   if(t.name===name)return t;
   if(free(p).has(t.name)){const renamed=this.fresh('r');return all(renamed,this.subst(this.subst(t.body,t.name,v(renamed)),name,p));}
   return all(t.name,this.subst(t.body,name,p));
  }
  if(t.tag==='arrow')return arrow(this.subst(t.domain,name,p),this.subst(t.body,name,p));
  if(t.tag==='down')return down(this.subst(t.body,name,p));
  if(t.tag==='up')return up(this.subst(t.body,name,p));
  return t;
 }
 apply(t){if(t.tag==='ev'){const x=this.ctx.find(x=>x.name===t.name&&x.tag==='guess');return x?.solution||t;}if(t.tag==='arrow')return arrow(this.apply(t.domain),this.apply(t.body));if(t.tag==='forall')return all(t.name,this.apply(t.body));if(t.tag==='down')return down(this.apply(t.body));if(t.tag==='up')return up(this.apply(t.body));return t;}
 wf(t,polarity,ctx=this.ctx){
  if(polarity==='positive'){
   if(t.tag==='var')return ctx.some(x=>x.tag==='rigid'&&x.name===t.name);
   if(t.tag==='ev')return ctx.some(x=>x.tag==='guess'&&x.name===t.name);
   if(t.tag==='down')return this.wf(t.body,'negative',ctx);
   return false;
  }
  if(t.tag==='arrow')return this.wf(t.domain,'positive',ctx)&&this.wf(t.body,'negative',ctx);
  if(t.tag==='forall')return !ctx.some(x=>x.name===t.name)&&this.wf(t.body,'negative',[...ctx,rigid(t.name)]);
  if(t.tag==='up')return this.wf(t.body,'positive',ctx);
  return false;
 }
 positive(p,q){
  this.step();p=this.apply(p);q=this.apply(q);
  if(!ground(p))throw Error('positive ground-side precondition');
  if(q.tag==='ev'){
   const index=this.ctx.findIndex(x=>x.tag==='guess'&&x.name===q.name);
   if(index<0||!this.wf(p,'positive',this.ctx.slice(0,index)))throw Error('solution out of scope');
   this.ctx[index].solution=p;return;
  }
  if(p.tag==='var'&&q.tag==='var'&&p.name===q.name&&this.wf(p,'positive'))return;
  if(p.tag==='down'&&q.tag==='down'){
   // Ashift↓: compare non-ground M with ground N, then reverse after completion.
   this.negative(q.body,p.body);this.negative(p.body,this.apply(q.body));return;
  }
  throw Error('positive shape/type mismatch');
 }
 negative(n,m){
  this.step();n=this.apply(n);m=this.apply(m);
  if(!ground(m))throw Error('negative ground-side precondition');
  // Aforallr must run before Aforalll whenever the target starts with forall.
  if(m.tag==='forall'){
   const name=this.fresh('r');this.ctx.push(rigid(name));
   try{this.negative(n,this.subst(m.body,m.name,v(name)));}finally{this.ctx.pop();}return;
  }
  if(n.tag==='forall'){
   const name=this.fresh('e');this.ctx.push(guess(name));
   try{this.negative(this.subst(n.body,n.name,ev(name)),m);}finally{this.ctx.pop();}return;
  }
  if(n.tag==='arrow'&&m.tag==='arrow'){
   this.positive(m.domain,n.domain);this.negative(this.apply(n.body),m.body);return;
  }
  if(n.tag==='up'&&m.tag==='up'){
   this.positive(m.body,n.body);this.positive(this.apply(n.body),m.body);return;
  }
  throw Error('negative shape/type mismatch');
 }
 spine(n,args){
  this.step();n=this.apply(n);
  // Source Aspinetypeabs rules precede the empty-spine rule for a forall head.
  if(n.tag==='forall'){
   if(!free(n.body).has(n.name))return this.spine(n.body,args);
   const name=this.fresh('e');this.ctx.push(guess(name));
   return this.spine(this.subst(n.body,n.name,ev(name)),args);
  }
  if(!args.length)return n;
  if(n.tag!=='arrow')throw Error('spine cannot consume argument');
  const [p,...tail]=args;if(!ground(p)||!this.wf(p,'positive'))throw Error('argument must have a supplied ground positive type');
  this.positive(p,n.domain);return this.spine(this.apply(n.body),tail);
 }
}
function compare(n,m,sort='negative'){
 const c=new Controls([rigid('int'),rigid('r')],[n,m]);
 try{assert(c.wf(n,sort)&&c.wf(m,sort));c[sort](n,m);return true;}catch{return false;}
}
function call(n,args){const c=new Controls([rigid('int'),rigid('r')],[n,...args]);assert(c.wf(n,'negative'));const out=c.apply(c.spine(n,args));return {c,out};}
function unambiguous(out){return out.tag==='up'&&ground(out.body);}
function annotated(result,p){const {c,out}=result;assert(out.tag==='up');c.positive(p,out.body);c.positive(c.apply(out.body),p);return c.apply(out);}
const a=v('a'),b=v('b'),r=v('r'),int=v('int');
const I=all('a',arrow(a,up(a))),IP=down(I),mono=arrow(int,up(int));
const choose=all('a',arrow(a,arrow(a,up(a))));
const revapp=all('a',all('b',arrow(a,arrow(down(arrow(a,up(b))),up(b)))));
const revappCurried=all('a',all('b',arrow(a,up(down(arrow(down(arrow(a,up(b))),up(b)))))));
const poly=down(arrow(IP,up(r)));
const observations=[];
function check(name,value,expected){assert.deepEqual(value,expected,name);observations.push({name,value});}
check('negative identity specializes',compare(I,mono),true);
check('monomorphic identity does not generalize',compare(mono,I),false);
check('invariant thunk blocks identity specialization',compare(IP,down(mono),'positive'),false);
check('invariant thunk blocks reverse specialization',compare(down(mono),IP,'positive'),false);
const identitySelf=call(I,[IP]);check('typed id(id) returns polymorphic thunk',pretty(identitySelf.out),pretty(up(IP)));
check('typed id(id) result is unambiguous',unambiguous(identitySelf.out),true);
check('choose same polymorphic values',pretty(call(choose,[IP,IP]).out),pretty(up(IP)));
assert.throws(()=>call(choose,[IP,down(mono)]));check('choose cannot silently specialize a thunk',true,true);
check('native partial choose has no returned value',call(choose,[IP]).out.tag,'arrow');
const whole=call(revapp,[IP,poly]);check('whole native revapp returns r',pretty(whole.out),'↑(r)');
const partial=call(revappCurried,[IP]);check('curried first call returns a value shape',partial.out.tag,'up');
check('curried first result remains ambiguous',unambiguous(partial.out),false);
const target=down(arrow(down(arrow(IP,up(r))),up(r)));
check('annotation fixes curried first result',pretty(annotated(partial,target)),pretty(up(target)));
check('annotated returned function consumes poly',pretty(call(target.body,[poly]).out),'↑(r)');
const unused=all('unused',up(IP));check('unused quantifier does not leave a result hole',unambiguous(call(unused,[]).out),true);
const scope=new Controls([guess('old'),rigid('late')]);assert.throws(()=>scope.positive(v('late'),ev('old')));check('older hole cannot capture a later rigid',true,true);
const permutation1=all('a',all('b',arrow(a,arrow(b,up(a)))));
const permutation2=all('b',all('a',arrow(a,arrow(b,up(a)))));
check('same-depth quantifiers are shift-isomorphic',compare(down(permutation1),down(permutation2),'positive'),true);
// Literal Figure11 also permits stopping an empty spine at a forall head.
// Record both derivations; the processor above deliberately chooses forall-first.
const literalHead=all('a',up(a)),w=new Controls([], [literalHead]);
const wn=w.fresh('w');w.ctx.push(guess(wn));
const literalOpened=w.subst(literalHead.body,'a',ev(wn));
const literalEmptySpineWitness={inputContext:[],spine:[],head:literalHead,
 derivations:[{rules:['Aspinenil'],result:literalHead,outputContext:[]},
 {rules:['Aspinetypeabsin','Aspinenil'],result:literalOpened,outputContext:structuredClone(w.ctx)}]};
check('literal empty-spine rules give different result shapes',literalHead.tag!==literalOpened.tag,true);
check('literal quantified input is well formed',new Controls([], [literalHead]).wf(literalHead,'negative'),true);
check('literal opened result is well formed in extended context',w.wf(literalOpened,'negative'),true);
console.log(JSON.stringify({schema:'ipf2022-native-type-controls-v1',origin:'Lynn source-rule reconstruction; not double-checked',source:'arXiv2203.01835v1 Figures9/11',typeLevelControlsOnly:true,noTermInference:true,noAuthorExecution:true,forallFirstControlPolicy:true,literalEmptySpineWitness,assertions:observations.length,observations},null,2));
