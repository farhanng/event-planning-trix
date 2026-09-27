import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, listEvents, resolveEvent, tabsForEvent, findTab, isWriteAllowed, validateTabKind } from '../src/infra/registry/registry.js';
import { makeRegistry, TABS } from './helpers.js';

test('loadRegistry validation', () => {
  assert.throws(() => loadRegistry(null), /bukan objek/);
  assert.throws(() => loadRegistry({}), /events/);
  assert.throws(() => loadRegistry({ events: [{}] }), /tanpa slug/);
  assert.throws(() => loadRegistry({ events: [{ slug: 'a' }, { slug: 'a' }] }), /duplikat/);
  const reg = loadRegistry({ events: [{ slug: 'a' }] }, 'src');
  assert.equal(reg.source, 'src');
  assert.equal(reg.portfolio, null);
  assert.deepEqual(reg.tabs, {});
  assert.deepEqual(reg.enums, {});
});

test('listEvents', () => {
  const out = listEvents(makeRegistry());
  assert.equal(out.length, 3);
  assert.deepEqual(Object.keys(out[0]).sort(), ['active', 'folder_id', 'has_registry', 'jenis', 'name', 'slug', 'spreadsheet_env', 'year']);
  assert.equal(out[0].has_registry, false);
});

test('resolveEvent', () => {
  const reg = makeRegistry();
  assert.equal(resolveEvent(reg, 'devfest26').slug, 'devfest26');
  assert.throws(() => resolveEvent(reg, ''), /wajib diisi/);
  assert.throws(() => resolveEvent(reg, 'nope'), /tidak ada di katalog/);
});

test('tabsForEvent + findTab', () => {
  const reg = makeRegistry();
  assert.equal(Object.keys(tabsForEvent(reg, 'devfest26')).length, Object.keys(TABS).length);
  assert.equal(validateTabKind(TABS['Budget 2026 (Draft)']), true);
  const regNoTabs = makeRegistry({ tabsByEvent: {} });
  assert.throws(() => tabsForEvent(regNoTabs, 'devfest26'), /tidak punya registry tab/);
  assert.equal(findTab(reg, 'devfest26', 'General Task').kind, 'Aktif');
  assert.throws(() => findTab(reg, 'devfest26', 'Missing'), /tidak terdaftar/);
  const regBad = makeRegistry({ tabsByEvent: { devfest26: { X: ['not-object'] } } });
  assert.throws(() => findTab(regBad, 'devfest26', 'X'), /tidak terdaftar/);
});

test('isWriteAllowed + validateTabKind', () => {
  assert.equal(isWriteAllowed({ kind: 'Aktif' }), true);
  assert.equal(isWriteAllowed({ kind: 'Arsip' }), false);
  assert.equal(isWriteAllowed({ kind: 'Draft' }), false);
  assert.equal(isWriteAllowed(null), true);
  assert.equal(validateTabKind({ kind: 'Turunan' }), true);
  assert.equal(validateTabKind({ kind: 'Zzz' }), false);
  assert.equal(validateTabKind(null), false);
});
