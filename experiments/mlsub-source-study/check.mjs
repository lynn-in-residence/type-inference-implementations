// Targeted author-implementation probes. No evaluator or independent subtype oracle.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const bin=process.env.MLSUB_BIN || process.argv[2];
assert(bin,'supply MLSUB_BIN or the author mlsub executable as argument');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mlsub-source-study-'));
const accepted=[
 ['self','fun x -> x x','(((a -> b) & a) -> b)'],
 ['self-bool','(fun x -> x x) (fun z -> true)','bool'],
 ['lambda-mixed','fun f -> {a = f 1; b = f true}','((bool | int -> a) -> {a : a, b : a})'],
 ['captured-alias','fun x -> let a = x in {i = a 1; b = a true}','((bool | int -> a) -> {i : a, b : a})'],
 ['twice','fun f -> fun x -> f (f x)','((a -> (b & a)) -> (a -> b))'],
 ['twice-bool','let twice = fun f -> fun x -> f (f x) in twice (fun z -> true)','(Top -> bool)'],
 ['twice-bool-int','let twice = fun f -> fun x -> f (f x) in twice (fun z -> true) 42','bool'],
];
function run(source){
 const file=path.join(dir,'input.ml');fs.writeFileSync(file,source+'\n');
 const r=spawnSync(bin,[file],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024});
 assert.equal(r.signal,null);assert(!r.error);
 return {exit:r.status,stdout:r.stdout,stderr:r.stderr};
}
try {
 const observations=accepted.map(([id,source,type])=>{
  const input='let res = '+source,r=run(input);assert.deepEqual(r,run(input));
  assert.deepEqual(r,{exit:0,stdout:'val res : '+type+'\n',stderr:''});
  return {id,source,signature:type,...r};
 });
 const bad='let res = (fun x -> x + 1) true',negative=run(bad);
 assert.deepEqual(negative,run(bad));assert.deepEqual(negative,{exit:0,stdout:'val res : <type error>\n',stderr:''});
 const queries=[
  '(((a | b) -> b) -> a -> b) <: ((a -> (b & a)) -> a -> b)',
  '((a -> (b & a)) -> a -> b) <: (((a | b) -> b) -> a -> b)',
  'int <: bool','bool <: int'];
 const checks=queries.map((q,i)=>{const r=run('check '+q);assert.deepEqual(r,run('check '+q));assert.equal(r.exit,0);assert.equal(r.stderr,'');assert(r.stdout.startsWith(i<2?'[Y] ':'[N] '));return {query:q,answer:i<2?'Y':'N',...r};});
 const malformed=run('let res = fun ->');assert.equal(malformed.exit,2);assert(malformed.stderr.includes('Parser.Make(L).MenhirBasics.Error'));
 // Parser exception strings are retained, but aren't typing rejection evidence.
 console.log(JSON.stringify({authorRevision:'fdec44b80cfa5bdc010da9cc012e75a96d0dd19f',scope:'7 inference successes, 1 type-error control, 4 author subsumption queries, 1 parser control; no evaluation',observations,negative:{source:bad,...negative},subsumption:checks,parserControl:malformed},null,2));
} finally {fs.rmSync(dir,{recursive:true,force:true});}
