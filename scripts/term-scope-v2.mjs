import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Syntax gate only. It never calls an inferencer and never returns a typing verdict.
// A versioned profile specifies supported forms, not whether a well-formed term types.
export const language = JSON.parse(fs.readFileSync(new URL('../data/term-language-v2.json', import.meta.url)));
const annotationTags = new Set(language.annotationTags);
const core = new Set(language.core);
const extensionOf = new Map(Object.entries(language.extensions).flatMap(([name,tags])=>tags.map(tag=>[tag,name])));
const typeTags = new Set(language.typeTags);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(node, expected) {
  assert(object(node), 'AST node must be an object');
  assert.deepEqual(Object.keys(node).sort(), expected.slice().sort(), 'unknown or missing AST field');
}
function name(value) { assert(typeof value==='string' && /^[A-Za-z_][A-Za-z_0-9]*$/.test(value), 'invalid identifier'); }
function labelled(values, valueField, visit) {
  assert(Array.isArray(values), 'fields must be an array');
  const labels=new Set();
  for(const value of values) {
    fields(value,['label',valueField]); name(value.label);
    assert(!labels.has(value.label),'duplicate record label'); labels.add(value.label);
    visit(value[valueField]);
  }
}
export function requirements(term, context=[]) {
  const terms=new Set(), types=new Set(), extensions=new Set();
  function type(node, annotation=false) {
    assert(object(node) && (typeTags.has(node.tag)||(annotation && annotationTags.has(node.tag))),'unknown type tag'); types.add(node.tag);
    switch(node.tag) {
      case 'tvar': fields(node,['tag','name']); name(node.name); break;
      case 'Int': case 'Bool': fields(node,['tag']); break;
      case 'arrow': fields(node,['tag','domain','codomain']); type(node.domain); type(node.codomain); break;
      case 'product': fields(node,['tag','left','right']); type(node.left); type(node.right); break;
      case 'forall':
        fields(node,['tag','vars','body']); assert(Array.isArray(node.vars) && node.vars.length>0,'empty quantification');
        node.vars.forEach(name); assert.equal(new Set(node.vars).size,node.vars.length,'repeated quantified variable'); type(node.body); break;
      case 'some':
        fields(node,['tag','vars','body']); assert(Array.isArray(node.vars) && node.vars.length>0,'empty some binder');
        node.vars.forEach(name); assert.equal(new Set(node.vars).size,node.vars.length,'repeated some variable'); type(node.body); break;
      case 'con': fields(node,['tag','name','args']); name(node.name); assert(Array.isArray(node.args),'constructor args must be an array'); node.args.forEach(t=>type(t)); break;
      case 'record-type': fields(node,['tag','fields']); labelled(node.fields,'type',type); break;
    }
  }
  function walk(node) {
    assert(object(node) && (core.has(node.tag)||extensionOf.has(node.tag)),'unknown term tag');
    if(core.has(node.tag)) terms.add(node.tag); else extensions.add(extensionOf.get(node.tag));
    switch(node.tag) {
      case 'var': fields(node,['tag','name']); name(node.name); break;
      case 'lambda': fields(node,['tag','param','body']); name(node.param); walk(node.body); break;
      case 'app': fields(node,['tag','fn','arg']); walk(node.fn); walk(node.arg); break;
      case 'let': fields(node,['tag','name','value','body']); name(node.name); walk(node.value); walk(node.body); break;
      case 'int': fields(node,['tag','value']); assert(typeof node.value==='string' && /^(0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(node.value),'integer must be a canonical decimal string'); break;
      case 'bool': fields(node,['tag','value']); assert(typeof node.value==='boolean','invalid Boolean'); break;
      case 'pair': fields(node,['tag','left','right']); walk(node.left); walk(node.right); break;
      case 'ann': fields(node,['tag','term','type']); walk(node.term); type(node.type,true); break;
      case 'annotated-lambda': fields(node,['tag','param','type','body']); name(node.param); type(node.type,true); walk(node.body); break;
      case 'inst': case 'generalize': fields(node,['tag','term']); walk(node.term); break;
      case 'freeze': fields(node,['tag','name']); name(node.name); break; // v1: frozen variable, not an arbitrary expression
      case 'type-app': fields(node,['tag','term','type']); walk(node.term); type(node.type); break;
      case 'record': fields(node,['tag','fields']); labelled(node.fields,'term',walk); break;
      case 'project': fields(node,['tag','term','label']); name(node.label); walk(node.term); break;
    }
  }
  assert(Array.isArray(context),'context must be an array');
  const bindings=new Set();
  for(const binding of context) {
    fields(binding,['name','type']); name(binding.name);
    assert(!bindings.has(binding.name),'duplicate context binding'); bindings.add(binding.name); type(binding.type);
  }
  const contextTypeTags=[...types].sort(); types.clear();
  walk(term);
  return {core:[...terms].sort(),extensions:[...extensions].sort(),typeTags:[...types].sort(),contextBindings:context.length,contextTypeTags};
}
export function scope(profileId, term, context=[]) {
  const profile=language.profiles.find(p=>p.id===profileId);
  assert(profile,`undeclared profile: ${profileId}`);
  const required=requirements(term,context);
  const missing=[
    ...required.core.filter(x=>!profile.core.includes(x)).map(x=>`core:${x}`),
    ...required.extensions.filter(x=>!profile.extensions.includes(x)).map(x=>`extension:${x}`),
    ...required.typeTags.filter(x=>!profile.typeTags.includes(x)).map(x=>`type:${x}`),
  ];
  // Structural type-language eligibility is separate from a typing derivation.
  function scanType(node, where, allowForall=false) {
    if(!profile.typeTags.includes(node.tag)) missing.push(where+':form:'+node.tag);
    if(node.tag==='forall') {
      if(!allowForall) missing.push(where+':non-prenex-quantifier');
      scanType(node.body,where,allowForall); return;
    }
    if(node.tag==='con') {
      if(profile.typeConstructors[node.name]!==node.args.length) missing.push(where+':constructor:'+node.name+'/'+node.args.length);
      node.args.forEach(t=>scanType(t,where,false));
    }
    if(node.tag==='arrow') {scanType(node.domain,where,false);scanType(node.codomain,where,false);}
    if(node.tag==='product') {scanType(node.left,where,false);scanType(node.right,where,false);}
    if(node.tag==='record-type') node.fields.forEach(f=>scanType(f.type,where,false));
  }
  for(const binding of context) scanType(binding.type,'context-type:'+binding.name,profile.context==='prenex');
  function scanTerm(node) {
    if(node.type) scanType(node.type,'annotation-type',false);
    for(const key of ['body','value','fn','arg','term','left','right']) if(node[key] && typeof node[key]==='object') scanTerm(node[key]);
    if(node.tag==='record') node.fields.forEach(f=>scanTerm(f.term));
  }
  scanTerm(term);
  const uniqueMissing=[...new Set(missing)];
  return {profile:profileId,status:uniqueMissing.length?'out-of-scope':'eligible',missing:uniqueMissing,required,
    boundary:'syntax eligibility only; eligible does not mean accepted or executed'};
}
const variable = n=>({tag:'var',name:n});
const identity = {tag:'lambda',param:'x',body:variable('x')};
const letIdentity = {tag:'let',name:'id',value:identity,body:variable('id')};
export function check() {
  const hm='milner-1978-pure-ml-fragment',wand='wand-1987-worked';
  const arrow=(domain,codomain)=>({tag:'arrow',domain,codomain});
  const a={tag:'tvar',name:'a'},id={tag:'forall',vars:['a'],body:arrow(a,a)};
  const single={tag:'forall',vars:['a'],body:arrow(a,{tag:'con',name:'List',args:[a]})};
  assert.equal(scope(hm,{tag:'app',fn:variable('single'),arg:variable('id')},[{name:'single',type:single},{name:'id',type:id}]).status,'eligible');
  for(const n of ['choose','head']) assert.equal(scope(hm,variable(n),[{name:n,type:{tag:'forall',vars:['a'],body:arrow(a,a)}}]).status,'eligible');
  const rank2=arrow(id,{tag:'product',left:{tag:'Int'},right:{tag:'Bool'}});
  const poly=scope(hm,variable('poly'),[{name:'poly',type:rank2}]);
  assert(poly.missing.includes('context-type:poly:non-prenex-quantifier'));assert.equal(poly.status,'out-of-scope');
  assert.equal(scope(hm,variable('ids'),[{name:'ids',type:{tag:'con',name:'List',args:[id]}}]).status,'out-of-scope');
  assert.equal(scope(wand,variable('f'),[{name:'f',type:arrow({tag:'Int'},{tag:'Bool'})}]).status,'eligible');
  assert(scope(wand,variable('id'),[{name:'id',type:id}]).missing.includes('context-type:id:form:forall'));
  assert(scope(hm,variable('x'),[{name:'x',type:{tag:'con',name:'List',args:[]}}]).missing.includes('context-type:x:constructor:List/0'));
  assert.deepEqual(scope(wand,{tag:'lambda',param:'y',body:letIdentity}).missing,['core:let']);
  for(const [tag,fields] of [['inst',{term:identity}],['generalize',{term:identity}],['freeze',{name:'id'}],['type-app',{term:variable('id'),type:{tag:'Int'}}]]) {
    const r=requirements({tag,...fields});assert.equal(r.extensions.length,1);assert.equal(scope(hm,{tag,...fields}).status,'out-of-scope');
  }
  const some={tag:'some',vars:['a'],body:arrow(a,a)};
  assert(requirements({tag:'ann',term:identity,type:some}).typeTags.includes('some'));
  assert.throws(()=>requirements(variable('x'),[{name:'x',type:some}])); // some describes annotations, not a context type
  assert.throws(()=>requirements({tag:'int',value:123}));assert.throws(()=>requirements({tag:'int',value:'-0'}));
  assert.throws(()=>requirements({...identity,surprise:true}));assert.throws(()=>requirements({tag:'magic'}));
  assert.throws(()=>requirements({tag:'freeze',term:identity}));assert.throws(()=>scope('unregistered',identity));
  assert.throws(()=>requirements({tag:'record',fields:[{label:'x',term:identity},{label:'x',term:identity}]}));
  assert.deepEqual(requirements({tag:'int',value:'90071992547409931234567890'}).core,['int']);
  const suite=JSON.parse(fs.readFileSync(new URL('../data/term-cases-v2.json',import.meta.url)));
  assert.equal(suite.language,language.schema);assert.equal(new Set(suite.cases.map(x=>x.id)).size,suite.cases.length);
  for(const fixture of suite.cases) {requirements(fixture.term,fixture.context);if(requirements(fixture.term).core.includes('let')) assert(scope(wand,fixture.term,fixture.context).missing.includes('core:let'));}
  console.log(JSON.stringify({check:'term-language-v2 syntax gate',profiles:language.profiles.map(p=>p.id),cases:suite.cases.length,contextSingle:'eligible',contextPoly:poly,typingVerdicts:0,review:'not double-checked'},null,2));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])) {
  if(process.argv[2]==='--check') check();
  else {
    assert(process.argv.length===4,'usage: node term-scope.mjs PROFILE CASE.json; or --check');
    const input=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
    console.log(JSON.stringify(scope(process.argv[2],input.term,input.context||[]),null,2));
  }
}
