import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Keep source identity and author expectations separate from runtime evidence.
// No executable is launched here: even the ignored case remains an expectation.
const [root, pinFile, specsFile] = process.argv.slice(2);
assert(root && pinFile && specsFile, 'usage: source-audit SOURCE PIN_JSON SPECIFICATIONS_JSON');
const pin = JSON.parse(fs.readFileSync(pinFile, 'utf8'));
const specifications = JSON.parse(fs.readFileSync(specsFile, 'utf8'));
assert.equal(pin.schema, 'freezeml-author-source-pin-v1');
assert.equal(specifications.schema, 'links-freezeml-upstream-specifications-v1');
assert.equal(pin.revision, '5ed2fa544249624b31348a14ad8391af0cf8fdfe');
assert.equal(specifications.revision, pin.revision);

const readSource = relative => {
  assert(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
  return fs.readFileSync(path.join(root, relative));
};
assert.equal(new Set(pin.files.map(file => file.path)).size, pin.files.length);
for (const file of pin.files) {
  const actual = crypto.createHash('sha256').update(readSource(file.path)).digest('hex');
  assert.equal(actual, file.sha256, `author source changed: ${file.path}`);
}

// The pinned upstream Python harness specifies blank-line-separated stanzas:
// a name, a source expression/file, then key : value expectations/options.
const tests = readSource('tests/freezeml.tests').toString('utf8').trim()
  .split(/\n\s*\n/).map(block => {
    const [name, code, ...lines] = block.split('\n');
    assert(name && code);
    const entries = lines.map(line => {
      const separator = line.indexOf(' : ');
      assert(separator > 0, `malformed upstream option: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 3)];
    });
    assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
    return { name, code, options: Object.fromEntries(entries) };
  });
assert.equal(new Set(tests.map(test => test.name)).size, tests.length);
assert.deepEqual(tests, specifications.tests);

const summary = {
  total: tests.length,
  expected_exit_zero: tests.filter(test => !test.options.exit || test.options.exit === '0').length,
  expected_exit_nonzero: tests.filter(test => test.options.exit && test.options.exit !== '0').length,
  ignored: tests.filter(test => test.options.ignore).map(test => ({
    name: test.name, reason: test.options.ignore,
  })),
};
assert.deepEqual(summary, pin.test_specifications);
for (const test of tests.filter(test => test.options.filemode)) {
  assert(pin.files.some(file => file.path === test.code), `unhashed fixture: ${test.code}`);
}
console.log(JSON.stringify({
  status: 'author source identities and expectation extraction verified; no compiler execution',
  revision: pin.revision,
  files_checked: pin.files.length,
  test_specifications: summary,
}, null, 2));
