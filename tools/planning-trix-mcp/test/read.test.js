import test from 'node:test';
import assert from 'node:assert/strict';
import { readTab, tabMeta } from '../src/app/tools/read.js';
import { makeCtx } from './helpers.js';

test('readTab reads rows via registry', async () => {
  const ctx = makeCtx();
  const out = await readTab({ ...ctx, args: { event: 'devfest26' } }, 'General Task');
  assert.equal(out.tab.entity, 'task');
  assert.equal(out.skipped, false);
  assert.equal(out.rows.length, 2);
});

test('readTab skips Arsip', async () => {
  const ctx = makeCtx();
  const out = await readTab({ ...ctx, args: { event: 'devfest26' } }, 'Agenda');
  assert.equal(out.skipped, true);
  assert.deepEqual(out.rows, []);
});

test('tabMeta', () => {
  assert.deepEqual(tabMeta({ title: 'X' }), { source_tabs: ['X'], warnings: [], conflicts: [] });
  assert.deepEqual(tabMeta({ title: 'Y' }, ['w']).warnings, ['w']);
});
