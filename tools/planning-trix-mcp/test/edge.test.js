import test from 'node:test';
import assert from 'node:assert/strict';
import { callTool } from '../src/app/register.js';
import { makeCtx, makeSheets, makeRegistry, TABS } from './helpers.js';
import { cellAt, rangeFor } from '../src/app/tools/rows.js';
import { listEvents, resolveEvent, tabsForEvent, loadRegistry } from '../src/infra/registry/registry.js';
import { createSheetsClient } from '../src/infra/sheets/client.js';
import { toMoney, toInt } from '../src/domain/normalize.js';

test('callTool event_catalog has no event param -> meta.event null', async () => {
  const out = await callTool('event_catalog', {}, makeCtx());
  assert.equal(out.ok, true);
  assert.equal(out.meta.event, null);
});

test('callTool carries rev from ctx.meta', async () => {
  const ctx = makeCtx({ meta: { env: 'dev', rev: 'r7' } });
  const out = await callTool('task_list', { event: 'devfest26' }, ctx);
  assert.equal(out.meta.rev, 'r7');
});

test('planning_index skips non-object tab entries', async () => {
  const registry = makeRegistry({
    tabsByEvent: { devfest26: { Good: TABS['General Task'], Bad: null, 'Bad2': ['nope'], Header: {} } },
  });
  const out = await callTool('planning_index', { event: 'devfest26' }, makeCtx({ registry }));
  const titles = out.data.tabs.map((t) => t.title);
  assert.deepEqual(titles, ['Good', 'Header']);
  assert.equal(out.data.tabs[1].kind, 'Aktif');
});

test('lo_roster tolerates null contact', async () => {
  const sheets = makeSheets({ 'Job on Stage 2026 (Clean)': [['b1'], ['b2'], ['b3'], ['b4'], ['No', 'Nama', 'Kontak', 'Asal', 'Peran LO', 'Status', 'Catatan'], ['1', 'Malendra', '', 'PDD-LO', 'Speaker Liaison', 'Aktif', '']] });
  const out = await callTool('lo_roster', { event: 'devfest26' }, makeCtx({ sheets }));
  assert.equal(out.data.count, 1);
  assert.equal(out.data.items[0].contact, null);
  assert.match(out.summary[0], /Malendra/);
});

test('design_tasks summary tolerates null deadline', async () => {
  const sheets = makeSheets({ 'Design Task': [['Design', 'Type', 'Designer', 'Status', 'Deadline', 'Note'], ['Poster', 'IG', 'Ghinna', 'On Progress', '', '']] });
  const out = await callTool('design_tasks', { event: 'devfest26' }, makeCtx({ sheets }));
  assert.equal(out.data.count, 1);
  assert.match(out.summary[0], /Ghinna \| Proses \| TBD/);
});

test('objectives handles empty percentage', async () => {
  const sheets = makeSheets({ 'Objectives': [['Objectives', 'Key Results (KR)', 'Sie Penanggung Jawab', 'Metrik dan Target', 'Target', 'Nilai', 'Percentage'], ['O1', 'KR 1.1', 'Humas', 'm', '85%', '', '']] });
  const out = await callTool('objectives', { event: 'devfest26' }, makeCtx({ sheets }));
  assert.equal(out.data.count, 1);
  assert.match(out.summary[0], /KR 1.1 \| Humas \| -/);
});

test('cellAt handles undefined slot', () => {
  assert.equal(cellAt([undefined], 'A'), null);
});

test('toMoney dotted and comma variants', () => {
  assert.equal(toMoney('1.234'), 1234);
  assert.equal(toMoney('1,234'), 1234);
  assert.equal(toMoney('1.234,5'), 1235);
});

test('toInt NaN path from dash-only string', () => {
  assert.equal(toInt('--'), null);
});

test('rangeFor ignores non-string column with string present', () => {
  assert.equal(rangeFor('Tab', { a: 'A', b: 5 }), "'Tab'!A:A");
});

test('listEvents falls back for sparse event metadata', () => {
  const registry = makeRegistry({ events: [{ slug: 'bare' }] });
  const [ev] = listEvents(registry);
  assert.equal(ev.name, 'bare');
  assert.equal(ev.folder_id, null);
  assert.equal(ev.spreadsheet_env, null);
  assert.equal(ev.active, false);
  assert.equal(ev.has_registry, false);
});

test('resolveEvent tolerates null slug', () => {
  const registry = makeRegistry();
  assert.throws(() => resolveEvent(registry, null), /wajib diisi/);
});

test('tabsForEvent falls back to event.tabs and registry.tabs', () => {
  const viaEvent = makeRegistry({ tabsByEvent: {}, events: [{ slug: 'devfest26', name: 'D', tabs: { 'General Task': TABS['General Task'] } }] });
  assert.ok(tabsForEvent(viaEvent, 'devfest26')['General Task']);
  const viaRoot = loadRegistry({ events: [{ slug: 'devfest26' }], tabs: { 'General Task': TABS['General Task'] } });
  assert.ok(tabsForEvent(viaRoot, 'devfest26')['General Task']);
});

test('batchGet tolerates missing valueRanges', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({}) });
  const client = createSheetsClient({ spreadsheetId: 'S', readOnly: false }, { getToken: async () => 't', fetch });
  assert.deepEqual(await client.batchGet(['A', 'B']), { A: [], B: [] });
});

test('callTool without meta on ctx uses null env', async () => {
  const ctx = makeCtx();
  delete ctx.meta;
  const out = await callTool('event_catalog', {}, ctx);
  assert.equal(out.meta.env, null);
});

test('callTool handles handler without summary/warnings/conflicts', async () => {
  const { TOOLS } = await import('../src/app/tools/index.js');
  const key = '__probe_no_summary__';
  TOOLS[key] = { description: 'probe', shape: {}, run: async () => ({ value: 1 }) };
  try {
    const out = await callTool(key, {}, makeCtx());
    assert.equal(out.ok, true);
    assert.deepEqual(out.summary, []);
    assert.deepEqual(out.meta.warnings, []);
    assert.deepEqual(out.meta.conflicts, []);
  } finally {
    delete TOOLS[key];
  }
});

test('callTool surfaces warnings + conflicts passthrough', async () => {
  const { TOOLS } = await import('../src/app/tools/index.js');
  const key = '__probe_warn__';
  TOOLS[key] = { description: 'probe', shape: {}, run: async () => ({ warnings: ['w'], conflicts: [{ field: 'f' }] }) };
  try {
    const out = await callTool(key, {}, makeCtx());
    assert.deepEqual(out.meta.warnings, ['w']);
    assert.deepEqual(out.meta.conflicts, [{ field: 'f' }]);
  } finally {
    delete TOOLS[key];
  }
});

test('rangeFor ignores empty-string column letters', () => {
  assert.equal(rangeFor('Tab', { a: '', b: 'B' }), "'Tab'!A:B");
});

test('tabsForEvent raw registry without tabsByEvent property', () => {
  const raw = { events: [{ slug: 'x' }], tabs: { T: { kind: 'Aktif' } } };
  assert.deepEqual(Object.keys(tabsForEvent(raw, 'x')), ['T']);
});

test('tabsForEvent throws when no tab map anywhere', () => {
  const raw = { events: [{ slug: 'x' }] };
  assert.throws(() => tabsForEvent(raw, 'x'), (e) => e.code === 'E_CONFIG');
});

test('rangeFor handles null columns map', () => {
  assert.equal(rangeFor('Tab', null), 'Tab');
});
