// Bounded native semantics reconstruction, not an inference implementation.
// Figure3 uses substitution for let-name; §3.2 also permits lexical suspensions.
// These controls use that alternative and retain call-by-value applications.
import assert from 'node:assert/strict';
const I=n=>({tag:'int',n}),V=x=>({tag:'var',x}),L=(x,body)=>({tag:'lambda',x,body}),A=(fn,arg)=>({tag:'app',fn,arg});
const Name=(x,value,body)=>({tag:'let-name',x,value,body});
const Val=(x,value,body)=>A(L(x,body),value); // §2.1's native derived form
const U=(op,arg)=>({tag:'unop',op,arg}),B=(op,left,right)=>({tag:'binop',op,left,right});
const K=(tag,fields={})=>({kind:'continuation',tag,...fields});
function run(term){
 let state={mode:'eval',term,env:new Map(),k:K('stop')},steps=0,allocations=0;const store=new Map();
 const evalAt=(term,env,k)=>({mode:'eval',term,env,k}),resume=(value,k)=>({mode:'resume',value,k});
 while(++steps<=1000){
  const {mode,k}=state;
  if(mode==='eval'){
   const {term:t,env:e}=state;
   switch(t.tag){
    case 'int':state=resume({kind:'int',n:t.n},k);break;
    case 'var':{const v=e.get(t.x);if(!v)return {answer:'wrong',allocations};state=v.kind==='suspension'?evalAt(v.term,v.env,k):resume(v,k);break;}
    case 'lambda':state=resume({kind:'closure',x:t.x,body:t.body,env:e},k);break;
    case 'app':state=evalAt(t.fn,e,K('apply1',{arg:t.arg,env:e,k}));break;
    case 'let-name':{const next=new Map(e);next.set(t.x,{kind:'suspension',term:t.value,env:e});state=evalAt(t.body,next,k);break;}
    case 'unop':state=evalAt(t.arg,e,K('unop',{op:t.op,k}));break;
    case 'binop':state=evalAt(t.left,e,K('binop1',{op:t.op,right:t.right,env:e,k}));break;
    default:throw Error('unsupported AST');
   }
  }else{
   const v=state.value;
   switch(k.tag){
    case 'stop':assert.equal(v.kind,'int','these controls return only integers');return {answer:v.n,allocations};
    case 'apply1':if(v.kind!=='closure')return {answer:'wrong',allocations};state=evalAt(k.arg,k.env,K('apply2',{closure:v,k:k.k}));break;
    case 'apply2':{const c=k.closure,e=new Map(c.env);e.set(c.x,v);state=evalAt(c.body,e,k.k);break;}
    case 'unop':
     if(k.op==='ref'){const location=++allocations;store.set(location,v);state=resume({kind:'location',location},k.k);}
     else if(k.op==='deref'){if(v.kind!=='location'||!store.has(v.location))return {answer:'wrong',allocations};state=resume(store.get(v.location),k.k);}
     else if(k.op==='callcc'){if(v.kind!=='closure')return {answer:'wrong',allocations};const e=new Map(v.env);e.set(v.x,k.k);state=evalAt(v.body,e,k.k);}
     else throw Error('unsupported unary operator');break;
    case 'binop1':state=evalAt(k.right,k.env,K('binop2',{op:k.op,left:v,k:k.k}));break;
    case 'binop2':
     if(k.op==='assign'){if(k.left.kind!=='location'||!store.has(k.left.location))return {answer:'wrong',allocations};store.set(k.left.location,v);state=resume(v,k.k);}
     else if(k.op==='throw'){if(k.left.kind!=='continuation')return {answer:'wrong',allocations};state=resume(v,k.left);}
     else throw Error('unsupported binary operator');break;
    default:throw Error('unsupported continuation');
   }
  }
 }
 throw Error('control exceeded1000steps');
}
// A supplied ground derivation for each callcc control; no unknowns or search.
const int='int',cont=t=>({cont:t}),arrow=(domain,codomain)=>({domain,codomain});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function certificate(t,want,env,order){
 switch(t.tag){
  case 'int':return equal(want,int);
  case 'var':return equal(env.get(t.x),want);
  case 'lambda':{if(!want?.domain)return false;const e=new Map(env);e.set(t.x,want.domain);return certificate(t.body,want.codomain,e,order);}
  case 'unop':return t.op==='callcc'&&certificate(t.arg,arrow(cont(want),want),env,order);
  case 'binop':{if(t.op!=='throw')return false;const types=order==='printed-value-first'?[int,cont(int)]:[cont(int),int];return certificate(t.left,types[0],env,order)&&certificate(t.right,types[1],env,order);}
  default:throw Error('certificate subset exceeded');
 }
}
const ref=U('ref',I(1)),assign=B('assign',V('r'),I(2)),deref=U('deref',V('r'));
const referenceBody=Val('ignored',assign,deref);
const identity=L('x',V('x'));
const polyBody=Val('ignored',B('assign',V('r'),L('x',I(1))),A(A(U('deref',V('r')),identity),I(5)));
const callccCases=[
 {id:'printed-throw-value-first',term:U('callcc',L('k',B('throw',I(1),V('k')))),expected:{answer:'wrong',allocations:0},printed:true,swapped:false},
 {id:'intended-throw-continuation-first',term:U('callcc',L('k',B('throw',V('k'),I(1)))),expected:{answer:1,allocations:0},printed:false,swapped:true},
 {id:'callcc-without-throw',term:U('callcc',L('k',I(1))),expected:{answer:1,allocations:0},printed:true,swapped:true}
];
const cases=[
 {id:'shared-let-val-reference',term:Val('r',ref,referenceBody),expected:{answer:2,allocations:1}},
 {id:'fresh-let-name-reference',term:Name('r',ref,referenceBody),expected:{answer:1,allocations:2}},
 {id:'unused-let-name-allocation',term:Name('unused',ref,I(5)),expected:{answer:5,allocations:0}},
 {id:'unused-let-val-allocation',term:Val('unused',ref,I(5)),expected:{answer:5,allocations:1}},
 {id:'polymorphic-reference-specializations',term:Name('r',U('ref',identity),polyBody),expected:{answer:5,allocations:2}},
 ...callccCases
];
const observations=cases.map(c=>{
 const observed=run(c.term);assert.deepEqual(observed,c.expected);
 const row={id:c.id,term:c.term,observed};
 if('printed'in c){const suppliedGroundCertificates={type:int,printedFigure4:certificate(c.term,int,new Map(),'printed-value-first'),swappedPremises:certificate(c.term,int,new Map(),'proposed-continuation-first')};assert.equal(suppliedGroundCertificates.printedFigure4,c.printed);assert.equal(suppliedGroundCertificates.swappedPremises,c.swapped);row.suppliedGroundCertificates=suppliedGroundCertificates;}
 return row;
});
console.log(JSON.stringify({scope:'eight bounded native evaluations; three supplied ground certificates; not inference, author runtime or a full theorem repair',observations},null,2));
