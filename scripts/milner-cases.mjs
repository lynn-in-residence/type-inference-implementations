import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inferW, inferJ} from './w-j.mjs';
import {scope} from './term-scope-v2.mjs';

const suite = JSON.parse(fs.readFileSync(
  new URL('../data/term-cases-v2.json', import.meta.url)
));

// Only adapt the declared closed toy fragment. This is a type experiment:
// exact integer/Boolean values are erased, not evaluated or rounded.
function adapt(term) {
  switch (term.tag) {
    case 'lambda': return {tag: 'lam', name: term.param, body: adapt(term.body)};
    case 'int': case 'bool': return {tag: term.tag};
    case 'var': return term;
    case 'app': return {tag: 'app', fn: adapt(term.fn), arg: adapt(term.arg)};
    case 'let': return {
      tag: 'let', name: term.name, value: adapt(term.value), body: adapt(term.body)
    };
    case 'pair': return {tag: 'pair', left: adapt(term.left), right: adapt(term.right)};
    default: throw new Error('unsupported adapter tag ' + term.tag);
  }
}

const rows = [];
for (const fixture of suite.cases.filter(c => !c.context.length)) {
  assert.equal(scope('milner-1978-pure-ml-fragment', fixture.term).status, 'eligible');
  const row = {id: fixture.id};
  for (const [name, engine] of [['W', inferW], ['J', inferJ]]) {
    try {
      row[name] = {type: engine(adapt(fixture.term))};
    } catch (error) {
      // Unexpected exceptions are failures of this experiment, never rejections.
      if (!['unbound-variable', 'occurs-check', 'constructor-clash'].includes(error.code)) throw error;
      row[name] = {rejected: error.code};
    }
  }
  assert.deepEqual(row.W, row.J);
  rows.push(row);
}
console.log(JSON.stringify(rows, null, 2));
