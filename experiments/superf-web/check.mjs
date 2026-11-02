// DOM adapter only. The author bundle is unchanged; no inference is reconstructed here.
// VM timeouts bound each test invocation. node:vm is not a security boundary.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=new URL('./',import.meta.url);
const fixtures=JSON.parse(fs.readFileSync(new URL('fixtures.json',root)));
const bundle=fs.readFileSync(process.env.SUPERF_BUNDLE);
assert.equal(crypto.createHash('sha256').update(bundle).digest('hex'),fixtures.bundleSHA256);
const results=[];
for(const f of fixtures.cases){
  // One fresh UI/compiler instance per fixture. The initial source is a fixed warmup.
  class TextArea {constructor(value){this.value=value;this.textContent=value;}addEventListener(){}}
  const input=new TextArea('fun x -> x'),output={innerHTML:''};
  const context={HTMLTextAreaElement:TextArea,document:{querySelector:s=>s==='#mlscript-input'?input:output},console:{log(){},error(){}},performance:{now:()=>0}};
  vm.createContext(context);
  vm.runInContext(bundle.toString('utf8'),context,{timeout:10000});
  input.value=f.source;context.inputEvent={target:input};
  // typecheck is the bundle's top-level lexical export, not a global object property.
  vm.runInContext('typecheck(inputEvent)',context,{timeout:10000});
  const html=output.innerHTML,text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const actual=/Parse error:/.test(text)?'parse-error':/Unexpected error:/.test(text)?'crash':/\[ERROR\]/.test(text)?'type-error':html.includes('<table>')?'accepted':'unknown';
  assert.equal(actual,f.expectedOutcome,`${f.id}: ${text}`);
  if(f.expectedText)assert.equal(text,f.expectedText,f.id);
  if(f.expectedContains)assert(text.includes(f.expectedContains),`${f.id}: ${text}`);
  results.push({id:f.id,source:f.source,outcome:actual,text,html});
}
const report={schema:'superf-author-web-probes-v1',revision:fixtures.revision,bundleSHA256:fixtures.bundleSHA256,implementation:'unchanged author Scala.js bundle, DOM-only Node adapter',profile:'MLscriptF web demo; noRecursiveTypes=true; fixed initial warmup; no program evaluation',notCoreColumnExecution:true,implementationReview:'not-double-checked',counts:results.reduce((a,r)=>(a[r.outcome]=(a[r.outcome]||0)+1,a),{}),results};
if(process.argv.includes('--record'))fs.writeFileSync(new URL('observations.json',root),JSON.stringify(report,null,2)+'\n');
else {const old=JSON.parse(fs.readFileSync(new URL('observations.json',root)));assert.deepEqual(report,old);}
console.log(JSON.stringify({probes:results.length,counts:report.counts,exactRecordedObservations:true,authorBundleUnchanged:true,coreColumnExecuted:false}));
