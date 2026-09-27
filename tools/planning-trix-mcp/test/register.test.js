import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { parseArgs, callTool } from '../src/app/register.js';
import { makeCtx } from './helpers.js';

const spec = { shape: { event: z.string().min(1) } };

test('parseArgs valid', () => {
  assert.deepEqual(parseArgs(spec, { event: 'devfest26' }), { event: 'devfest26' });
  assert.deepEqual(parseArgs({ shape: {} }, null), {});
});

test('parseArgs invalid -> E_VALIDATION', () => {
  assert.throws(() => parseArgs(spec, {}), (e) => e.code === 'E_VALIDATION' && e.details.issues.length === 1);
});

test('callTool unknown tool', async () => {
  const out = await callTool('nope', {}, makeCtx());
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'E_INTERNAL');
  assert.equal(out.meta.env, 'dev');
});

test('callTool unknown tool without ctx', async () => {
  const out = await callTool('nope', {}, undefined);
  assert.equal(out.meta.env, null);
});

test('callTool validation error envelope', async () => {
  const out = await callTool('planning_index', {}, makeCtx());
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'E_VALIDATION');
});

test('callTool success envelope with meta', async () => {
  const out = await callTool('task_list', { event: 'devfest26' }, makeCtx());
  assert.equal(out.ok, true);
  assert.equal(out.meta.event, 'devfest26');
  assert.equal(out.meta.env, 'dev');
  assert.deepEqual(out.meta.source_tabs, ['General Task']);
  assert.ok(out.summary.length);

  const budget = await callTool('budget_summary', { event: 'devfest26' }, makeCtx());
  assert.equal(budget.meta.source_tabs.length, 2);
});

test('callTool handler error -> error envelope (no env)', async () => {
  const out = await callTool('task_list', { event: 'nope' }, { registry: makeCtx().registry, sheets: makeCtx().sheets });
  assert.equal(out.ok, false);
  assert.equal(out.error.code, 'E_EVENT_UNKNOWN');
  assert.equal(out.meta.env, null);
});
