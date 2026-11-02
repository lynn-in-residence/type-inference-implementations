import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// This harness exercises the pinned author binary. It does not implement typing.
// Keep paper expectations distinct from observed prototype behavior.
const cases = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url)));
const binary = process.env.LCTI_BIN;
if (!binary) throw new Error('set LCTI_BIN to the pinned Poly executable');
const selected = process.argv[3];
const mode = process.argv[2] ?? '--check';
if (!['--check', '--trace', '--tree'].includes(mode)) throw new Error('use --check, --trace [name], or --tree name');
if (selected && !cases.fixtures.some(f => f.name === selected)) throw new Error(`unknown fixture ${selected}`);
if (mode === '--tree' && !selected) throw new Error('--tree requires a fixture name');

function run(fixture, tree = false) {
  // Every fixture starts a fresh process: definitions cannot leak across cases.
  const input = [...cases.definitions.map(d => `:define ${d}`),
    `${tree ? ':tree ' : ''}${fixture.term}`, ':q', ''].join('\n');
  const p = spawnSync(binary, [], {input, encoding:'utf8', timeout:10000, maxBuffer:16*1024*1024});
  if (p.error) throw p.error;
  assert.equal(p.status, 0, p.stderr);
  assert.equal(p.stderr, '');
  // Haskeline emits prompts even with pipe input. Check their count before using
  // the final answer so an unexpected REPL transcript cannot silently pass.
  const chunks = p.stdout.replace(/\x1b\[[0-9;]*m/g, '').split(/^> /m);
  assert.equal(chunks.length, cases.definitions.length + 3);
  assert.equal(chunks.at(-1).trim(), 'Bye.');
  const result = chunks.at(-2).trim();
  assert(!/parse error|lexical error/i.test(result), result);
  return result;
}

if (mode === '--tree') {
  process.stdout.write(run(cases.fixtures.find(f => f.name === selected), true) + '\n');
} else {
  let checked=0, differences=0;
  const reports=[];
  for (const f of cases.fixtures.filter(f => !selected || f.name === selected)) {
    const raw = run(f);
    const observed = raw.startsWith('Error:') ? 'reject' : raw;
    assert.equal(observed, f.prototype, `${f.name}: unexpected prototype behavior\n${raw}`);
    if (f.errorContains) assert(raw.includes(f.errorContains), `${f.name}: wrong failure reason`);
    if (f.paper !== f.prototype) {
      assert(f.knownDiscrepancy, `${f.name}: unrecorded paper/prototype difference`);
      differences++;
    }
    checked++;
    reports.push(`${f.name}\n  term: ${f.term}\n  paper: ${f.paper}\n  pinned prototype: ${observed}` +
      (f.knownDiscrepancy ? `\n  discrepancy: ${f.knownDiscrepancy}` : ''));
  }
  console.log(mode === '--trace' ? reports.join('\n\n') :
    `${checked} pinned-prototype fixtures checked; ${differences} recorded paper/prototype discrepancy. No metatheory proof rechecked.`);
}
