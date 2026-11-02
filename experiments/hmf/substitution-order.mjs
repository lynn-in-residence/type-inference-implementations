// An isolated reconstruction of the two substitutions in HMF §6.6.
// This does not run HMF inference or inspect the author's implementation.
import assert from 'node:assert/strict';

// Applying a substitution once does not recursively chase its own range.
// The paper requires substitutions to be idempotent; this check tests that.
const apply = (s, x) => s[x] ?? x;
const compose = (s, t) => Object.fromEntries(
  ['a', 'b'].map(x => [x, apply(s, apply(t, x))])
);
const S = {a: 'b'};
const T = {b: 'Int'};
const printed = compose(S, T);
const reversed = compose(T, S);
assert.deepEqual(printed, {a: 'b', b: 'Int'});
assert.deepEqual(reversed, {a: 'Int', b: 'Int'});
assert.notEqual(apply(printed, 'a'), apply(printed, 'b'));
assert.notEqual(apply(printed, apply(printed, 'a')), apply(printed, 'a'));
assert.equal(apply(reversed, 'a'), apply(reversed, 'b'));
console.log(JSON.stringify({printed, reversed, boundary: 'two-substitution reconstruction only'}));
