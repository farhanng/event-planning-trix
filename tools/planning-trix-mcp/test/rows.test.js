import test from 'node:test';
import assert from 'node:assert/strict';
import { colToIndex, cellAt, rangeFor, mapRows } from '../src/app/tools/rows.js';

test('colToIndex', () => {
  assert.equal(colToIndex('A'), 0);
  assert.equal(colToIndex('Z'), 25);
  assert.equal(colToIndex('AA'), 26);
  assert.equal(colToIndex('a'), 0);
  assert.equal(colToIndex(''), null);
  assert.equal(colToIndex(5), null);
  assert.equal(colToIndex('A1'), null);
});

test('cellAt', () => {
  assert.equal(cellAt(['x', 'y'], 'B'), 'y');
  assert.equal(cellAt(['x'], 'Z'), null);
  assert.equal(cellAt('nope', 'A'), null);
  assert.equal(cellAt(null, 'A'), null);
});

test('rangeFor', () => {
  assert.equal(rangeFor('Tab', { a: 'A', b: 'C' }), "'Tab'!A:C");
  assert.equal(rangeFor('Tab', {}), 'Tab');
  assert.equal(rangeFor('Tab', { a: null, b: 5 }), 'Tab');
});

test('mapRows', () => {
  const rows = [['H1', 'H2'], ['a', 'b'], ['', '  '], ['c', 'd']];
  const out = mapRows(rows, { headerRow: 1, columns: { x: 'A', y: 'B' } });
  assert.deepEqual(out, [{ x: 'a', y: 'b' }, { x: 'c', y: 'd' }]);
  assert.deepEqual(mapRows(null, { columns: { x: 'A' } }), []);
  assert.deepEqual(mapRows([['h'], ['v']], { headerRow: 0, columns: { x: 'A' } }), [{ x: 'v' }]);
  assert.deepEqual(mapRows([['h1'], ['h2'], ['v']], { headerRow: 2, columns: { x: 'A' } }), [{ x: 'v' }]);
});
