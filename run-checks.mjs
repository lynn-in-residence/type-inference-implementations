import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const scripts=['w-j','constraints','bidirectional','hp99-bounds','tr495-rigidity','hhs02-diagnostics','km07-ranks','quicklook-order-check','term-scope','term-scope-v2','milner-cases','starter-matrix'];
const experiments=['dunfield2009/measure-check','freezeml-2022-interface/check','guarded/eqfully','hmf/substitution-order','ipf2022-controls/check','jim1995-controls/check','kw1993-rule-controls/check','lc2007-controls/check','leroy1993-controls/check','mitchell1991-proof-controls/check','mlstruct2022-controls/check','simple-sub-source-study/listing-check'];
let failed=false;
for(const relative of [...scripts.map(x=>'scripts/'+x+'.mjs'),...experiments.map(x=>'experiments/'+x+'.mjs')]){
 const args=[relative,...(['w-j','constraints','bidirectional','term-scope','term-scope-v2'].some(x=>relative==='scripts/'+x+'.mjs')?['--check']:[])];
 const start=performance.now();const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 const ok=!result.error&&result.status===0;
 console.log(JSON.stringify({file:relative,ok,elapsedMs:Math.round(performance.now()-start)}));
 if(!ok){failed=true;process.stderr.write(result.stderr??'');process.stderr.write(result.stdout??'');if(result.error)console.error(result.error);}
}
if(failed)process.exitCode=1;
