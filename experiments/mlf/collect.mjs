// Observe the actual author CLI. Its caught type errors exit zero: only the
// full diagnostic and a separate syntax control establish what ran.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exe = process.env.CAMLF_EXE;
assert(exe, 'use nix run .#observations');
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));
assert.equal(new Set(fixtures.map(f => f.id)).size, fixtures.length);
const work = mkdtempSync(join(tmpdir(), 'camlf-witness-'));
let sequence = 0;
function invoke(source, trace = false) {
  const dir = join(work, String(sequence++));
  mkdirSync(join(dir, 'dot'), { recursive: true });
  // Keep author defaults; do not inherit a caller's DEBUG_* switches.
  const r = spawnSync(exe, [...(trace ? ['-trace_solve'] : []), '-expr', source], {
    cwd: dir, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
    env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' }
  });
  assert.ifError(r.error);
  assert.equal(r.signal, null);
  const dot = Object.fromEntries(readdirSync(join(dir, 'dot')).sort().map(name =>
    [name, readFileSync(join(dir, 'dot', name), 'utf8')]));
  return { exit: r.status, stdout: r.stdout, stderr: r.stderr, dot };
}
function verdict(r) {
  if (r.exit === 0 && r.stderr === '' && /^val _ : [^\n]+\n$/.test(r.stdout))
    return { accepted: true, signature: r.stdout.slice(8, -1) };
  if (r.exit === 0 && r.stderr === '' && r.stdout.includes('Unification error between:') &&
      !r.stdout.includes('Unknown error'))
    return { accepted: false, signature: null };
  throw new Error('unexpected CLI response: ' + JSON.stringify(r));
}
try {
  const syntax = invoke('fun ->');
  assert.equal(syntax.exit, 2);
  assert.equal(syntax.stdout, '');
  assert(syntax.stderr.includes('SyntaxErrors.ParsingError'));
  assert.throws(() => verdict(syntax), /unexpected CLI response/);
  const unbound = invoke('absentName');
  assert.equal(unbound.exit, 0);
  assert(unbound.stdout.includes("Unbound var 'absentName'"));
  assert.throws(() => verdict(unbound), /unexpected CLI response/);
  const records = fixtures.map(f => {
    const observed = invoke(f.source);
    assert.deepEqual(invoke(f.source), observed, f.id + ': fresh-process observations changed');
    assert.deepEqual(verdict(observed), { accepted: f.accepted, signature: f.signature }, f.id);
    // The author's trace observer prints graphs before each instantiation edge
    // is solved. Compare its final CLI answer with the ordinary path, retaining
    // both transcripts. This does not instrument a new inference engine.
    let trace = null;
    if (['constant', 'choose-id', 'shared-frontier'].includes(f.id)) {
      trace = invoke(f.source, true);
      assert.deepEqual(invoke(f.source, true), trace, f.id + ': unstable trace');
      assert.equal(trace.exit, 0);
      assert.equal(trace.stderr, '');
      assert(trace.stdout.includes('\nSOLVE\n'));
      const answers = [...trace.stdout.matchAll(/^val _ : (.+)$/gm)].map(m => m[1]);
      assert.deepEqual(answers, [f.signature], f.id + ': tracing changed printed result');
    }
    return { ...f, observed, trace };
  });
  const result = {
    boundary: 'Unchanged 2011 camlf CLI and inference files; 12 adapter probes, not the full author suite or original 2003 WF. Three author solve traces; no xMLF elaboration, evaluation, benchmark or metatheory recheck.',
    summary: '12 fixtures: 10 accepted, 2 type rejections; separate syntax and unbound-name controls; rejected typings still exit zero. Three trace-observer comparisons and fresh-process bytewise repeats.',
    controls: { syntax, unbound }, fixtures: records
  };
  if (process.argv.includes('--check')) process.stdout.write(result.summary + '\n');
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} finally {
  rmSync(work, { recursive: true, force: true });
}
