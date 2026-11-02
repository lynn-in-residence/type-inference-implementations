// The archive hash fixes the complete upstream tree. These identities make
// the specifically exercised parser, inference and observer boundary legible.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const manifest = JSON.parse(readFileSync(new URL('./source-identities.json', import.meta.url)));
const root = process.argv[2];
assert(root, 'supply the extracted camlf source directory');
for (const [name, expected] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(readFileSync(join(root, name))).digest('hex');
  assert.equal(actual, expected, 'author source changed: ' + name);
}
console.log(Object.keys(manifest.files).length + ' author source identities match');
