// This adapter runs two unchanged author solvers. MLsub's own subsumption
// checker is the comparison oracle, not an independent proof of equivalence.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const simpleBin = process.env.SIMPLE_SUB_BIN;
const mlBin = process.env.MLSUB_BIN;
assert(simpleBin && mlBin, 'use the flake check app (it supplies both executables)');
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
assert.equal(new Set(fixtures.map(f => f.id)).size, fixtures.length);
const mode = process.argv[2] ?? '--check';
assert(['--check', '--trace', '--twice'].includes(mode), 'usage: --check | --trace | --twice');
const dir = mkdtempSync(join(tmpdir(), 'algebraic-subtyping-'));

function invoke(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.signal, null, `${bin} terminated by ${r.signal}`);
  return r;
}
function simple(source, unobserved = false) {
  const r = invoke(simpleBin, [source, ...(unobserved ? ['--unobserved'] : [])]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  // One JSON object, with no debug text or second response mixed into stdout.
  const value = JSON.parse(r.stdout);
  assert.equal(typeof value.accepted, 'boolean');
  return { value, stdout: r.stdout };
}
function mlFile(source) {
  const path = join(dir, 'query.ml');
  writeFileSync(path, source);
  const r = invoke(mlBin, [path]);
  assert.equal(r.status, 0, source + "\n" + r.stderr);
  assert.equal(r.stderr, '');
  assert(!/Typechecking failed|Match failure|parser error|syntax error/.test(r.stdout), source + "\n" + r.stdout);
  return r.stdout;
}
// File mode exits cleanly; the author's infinite REPL instead throws on EOF.
// MLsub has arithmetic operators, whereas Simple-sub provides these names.
// These two definitions give the tests the same int -> int / int -> int -> int
// assumptions. They do not modify inference or introduce additional type axioms.
const prelude = 'let succ = fun x -> x + 1\nlet add = fun x -> fun y -> x + y\n';
function inferMl(source) {
  const stdout = mlFile(prelude + 'let res = ' + source + '\n');
  const rows = stdout.trim().split(/\n(?=val )/).map(s => s.replace(/\s+/g, ' '));
  assert.equal(rows.length, 3, stdout);
  assert.equal(rows[0], 'val succ : (int -> int)');
  assert.equal(rows[1], 'val add : (int -> (int -> int))');
  assert(rows[2].startsWith('val res : '), stdout);
  return { signature: rows[2].slice('val res : '.length), stdout };
}
function subsume(left, right) {
  // The author comparison adapter likewise replaces record-printer commas
  // with the semicolons required by MLsub's type parser. Keep raw output below.
  const parserType = t => t.replaceAll(',', ';');
  const stdout = mlFile(`check (${parserType(left)}) <: (${parserType(right)})\ncheck (${parserType(right)}) <: (${parserType(left)})\n`);
  const verdicts = [...stdout.matchAll(/^\[([YN])\]/gm)].map(m => m[1]);
  assert.equal(verdicts.length, 2, stdout);
  // Wrapped continuation lines may only continue the two judgments.
  assert(stdout.trim().split(/\n(?=\[)/).every(s => /^\[[YN]\] .+ <: /s.test(s)), stdout);
  return { verdicts, stdout };
}

try {
  // Negative controls verify genuine parser failure is never counted as a type
  // rejection and that the comparison checker does not simply answer yes.
  const badSimple = invoke(simpleBin, ['fun ->']);
  assert.equal(badSimple.status, 2);
  assert.equal(badSimple.stdout, '');
  assert(badSimple.stderr.length > 0);
  writeFileSync(join(dir, 'bad.ml'), 'let res = fun ->\n');
  const badMl = invoke(mlBin, [join(dir, 'bad.ml')]);
  assert.notEqual(badMl.status, 0);
  assert(badMl.stderr.includes('Parser.Make(L).MenhirBasics.Error'), badMl.stderr);
  const negative = subsume('int', 'bool');
  assert.deepEqual(negative.verdicts, ['N', 'N']);

  const records = [];
  for (const f of fixtures) {
    const observed = simple(f.source);
    // Fresh-process repeat catches non-deterministic graph/printer ordering.
    assert.equal(simple(f.source).stdout, observed.stdout, `${f.id}: unstable observations`);
    const direct = simple(f.source, true).value;
    assert.equal(observed.value.accepted, f.accepted, f.id);
    assert.equal(direct.accepted, f.accepted, f.id);
    let ml, comparison = null;
    if (f.accepted) {
      assert.equal(observed.value.final, f.simpleFinal, `${f.id}: independently declared fixture type`);
      assert.equal(direct.final, observed.value.final, `${f.id}: observer changed final type`);
      assert.equal(direct.mlsubSyntax, observed.value.mlsubSyntax);
      for (const key of ['raw', 'bounds', 'coalesced', 'compact', 'simplifiedCompact', 'mlsubSyntax'])
        assert.equal(typeof observed.value[key], 'string', `${f.id}: ${key}`);

    } else {
      assert.equal(observed.value.error, f.simpleError, f.id);
      assert.deepEqual(direct, observed.value);
    }
    if (f.mlsubParsed === false) {
      // This is a front-end boundary, never an inference rejection. The pinned
      // MLsub obj/typeobj grammar requires at least one field. Do not patch it.
      writeFileSync(join(dir, 'query.ml'), prelude + 'let res = ' + f.source + '\n');
      const r = invoke(mlBin, [join(dir, 'query.ml')]);
      assert.equal(r.status, 2, f.id);
      assert.equal(r.stdout, '');
      assert.equal(r.stderr, 'Fatal error: exception Parser.Make(L).MenhirBasics.Error\n');
      ml = { parsed: false, exit: r.status, stdout: r.stdout, stderr: r.stderr };
    } else {
      ml = inferMl(f.source);
      assert.equal(ml.signature !== '<type error>', f.accepted, `${f.id}: MLsub acceptance`);
      if (f.accepted) {
        comparison = subsume(observed.value.mlsubSyntax, ml.signature);
        assert.deepEqual(comparison.verdicts, ['Y', 'Y'], `${f.id}: schemes not mutually subsumed`);
      }
    }
    records.push({ id: f.id, origin: f.origin, source: f.source, simple: observed.value,
      mlsub: ml, mutualSubsumption: comparison });
  }
  const shared = fixtures.filter(f => f.mlsubParsed !== false);
  const accepted = shared.filter(f => f.accepted).length;
  const summary = `${shared.length} shared-syntax fixtures: ${accepted} accepted by both, ${shared.length - accepted} rejected by both; ${accepted * 2} positive and 2 negative MLsub subsumption judgments. 1 empty-record front-end boundary; stable fresh-process observations.\n`;
  if (mode === '--check') process.stdout.write(summary);
  else if (mode === '--trace') process.stdout.write(JSON.stringify({ boundary:
    'Unmodified pinned author inference; Simple-sub compactType pipeline; MLsub own scheme-subsumption oracle. No evaluation, benchmark, million-case rerun or equivalence theorem.',
    summary: summary.trim(), negativeControl: negative, fixtures: records }, null, 2) + '\n');
  else process.stdout.write(JSON.stringify(records.find(f => f.id === 'twice'), null, 2) + '\n');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
