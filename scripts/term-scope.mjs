import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Syntax gate only. It never calls an inferencer and never returns a typing verdict.
// A versioned profile specifies supported forms, not whether a well-formed term types.
export const language = JSON.parse(fs.readFileSync(new URL('../data/term-language-v1.json', import.meta.url)));
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
  function type(node) {
    assert(object(node) && typeTags.has(node.tag),'unknown type tag'); types.add(node.tag);
    switch(node.tag) {
      case 'tvar': fields(node,['tag','name']); name(node.name); break;
      case 'Int': case 'Bool': fields(node,['tag']); break;
      case 'arrow': fields(node,['tag','domain','codomain']); type(node.domain); type(node.codomain); break;
      case 'product': fields(node,['tag','left','right']); type(node.left); type(node.right); break;
      case 'forall':
        fields(node,['tag','vars','body']); assert(Array.isArray(node.vars) && node.vars.length>0,'empty quantification');
        node.vars.forEach(name); assert.equal(new Set(node.vars).size,node.vars.length,'repeated quantified variable'); type(node.body); break;
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
      case 'ann': fields(node,['tag','term','type']); walk(node.term); type(node.type); break;
      case 'annotated-lambda': fields(node,['tag','param','type','body']); name(node.param); type(node.type); walk(node.body); break;
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
  walk(term);
  return {core:[...terms].sort(),extensions:[...extensions].sort(),typeTags:[...types].sort(),contextBindings:context.length};
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
  if(profile.context==='closed-only' && context.length) missing.push('context:external-bindings');
  return {profile:profileId,status:missing.length?'out-of-scope':'eligible',missing,required,
    boundary:'syntax eligibility only; eligible does not mean accepted or executed'};
}
const variable = n=>({tag:'var',name:n});
const identity = {tag:'lambda',param:'x',body:variable('x')};
const letIdentity = {tag:'let',name:'id',value:identity,body:variable('id')};
export function check() {
  for(const profile of language.profiles) {
    assert.equal(new Set(profile.core).size,profile.core.length);
    profile.core.forEach(tag=>assert(core.has(tag),'unknown profile core form'));
    profile.extensions.forEach(ext=>assert(Object.hasOwn(language.extensions,ext),'unknown profile extension'));
    profile.typeTags.forEach(tag=>assert(typeTags.has(tag),'unknown profile type form'));
  }
  assert.equal(scope('wand-1987-worked',identity).status,'eligible');
  assert.equal(scope('wand-1987-worked',variable('f'),[{name:'f',type:{tag:'arrow',domain:{tag:'Int'},codomain:{tag:'Bool'}}}]).status,'eligible');
  assert.deepEqual(scope('wand-1987-worked',letIdentity).missing,['core:let']);
  assert.equal(scope('lynn-w-j-pure-core',letIdentity).status,'eligible');
  // A let nested under another node must not slip through the gate.
  assert.deepEqual(scope('wand-1987-worked',{tag:'lambda',param:'y',body:letIdentity}).missing,['core:let']);
  assert.equal(scope('wand-1987-worked',{tag:'app',fn:variable('x'),arg:variable('x')}).status,'eligible');
  // x x passes syntax; this checker deliberately cannot claim a type rejection.
  const samples=[
    ['expression-annotation',{tag:'ann',term:identity,type:{tag:'arrow',domain:{tag:'tvar',name:'a'},codomain:{tag:'tvar',name:'a'}}}],
    ['binder-annotation',{tag:'annotated-lambda',param:'x',type:{tag:'Int'},body:variable('x')}],
    ['freeze',{tag:'freeze',name:'id'}],
    ['explicit-type-application',{tag:'type-app',term:variable('id'),type:{tag:'Int'}}],
    ['records',{tag:'record',fields:[{label:'x',term:identity}]}],
    ['records',{tag:'project',term:variable('r'),label:'x'}],
  ];
  for(const [ext,term] of samples) {
    assert.deepEqual(requirements(term).extensions,[ext]);
    assert(scope('lynn-w-j-pure-core',term).missing.includes(`extension:${ext}`));
  }
  assert(scope('lynn-w-j-pure-core',identity,[{name:'f',type:{tag:'Int'}}]).missing.includes('context:external-bindings'));
  assert.throws(()=>requirements({...identity,surprise:true}));
  assert.throws(()=>requirements({tag:'magic'}));
  assert.throws(()=>requirements({tag:'record',fields:[{label:'x',term:identity},{label:'x',term:identity}]}));
  assert.throws(()=>scope('unregistered-paper',identity));
  assert.throws(()=>requirements({tag:'freeze',term:identity}));
  assert.throws(()=>requirements({tag:'int',value:123}));
  assert.throws(()=>requirements({tag:'int',value:'-0'}));
  assert.deepEqual(requirements({tag:'int',value:'90071992547409931234567890'}).core,['int']);
  assert.deepEqual(requirements({tag:'pair',left:{tag:'int',value:'123'},right:{tag:'bool',value:true}}).core,['bool','int','pair']);
  const suite=JSON.parse(fs.readFileSync(new URL('../data/term-cases-v1.json',import.meta.url)));
  assert.equal(suite.schema,'atlas-term-cases-v1');assert.equal(suite.language,language.schema);
  assert.equal(new Set(suite.cases.map(c=>c.id)).size,suite.cases.length);
  for(const fixture of suite.cases) {
    const requirementsForCase=requirements(fixture.term,fixture.context);
    if(requirementsForCase.core.includes('let')) assert(scope('wand-1987-worked',fixture.term,fixture.context).missing.includes('core:let'));
    assert.equal(scope('lynn-w-j-pure-core',fixture.term,fixture.context).status,'eligible');
  }
  console.log(JSON.stringify({check:'term-language-v1 syntax gate',profiles:language.profiles.map(p=>p.id),
    wandLet:scope('wand-1987-worked',letIdentity),witnessLet:scope('lynn-w-j-pure-core',letIdentity),
    typingVerdicts:0,review:'not double-checked'},null,2));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])) {
  if(process.argv[2]==='--check') check();
  else {
    assert(process.argv.length===4,'usage: node term-scope.mjs PROFILE CASE.json; or --check');
    const input=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
    console.log(JSON.stringify(scope(process.argv[2],input.term,input.context||[]),null,2));
  }
}
