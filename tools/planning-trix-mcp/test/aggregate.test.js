import test from 'node:test';
import assert from 'node:assert/strict';
import { sumBy, uniqueBy } from '../src/domain/aggregate.js';

test('sumBy', () => {
  assert.equal(sumBy([{ a: 1 }, { a: 2 }, {}], 'a'), 3);
  assert.equal(sumBy(null, 'a'), 0);
  assert.equal(sumBy([{ a: 'x' }], 'a'), 0);
});

test('uniqueBy dedups by key, keeps null-key rows', () => {
  const out = uniqueBy([{ id: 'a' }, { id: 'a' }, { id: null }, { id: 'b' }], (r) => r.id);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((r) => r.id), ['a', null, 'b']);
  assert.deepEqual(uniqueBy(null, (r) => r.id), []);
});
