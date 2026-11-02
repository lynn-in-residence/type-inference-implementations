import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('source-manifest.json',import.meta.url)));
for(const row of manifest.files){assert(!row.path.startsWith('/')&&!row.path.split('/').includes('..'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(row.path,root))).digest('hex'),row.sha256,row.path);}
console.log(JSON.stringify({publicationCopies:manifest.files.length,hashesMatch:true}));
