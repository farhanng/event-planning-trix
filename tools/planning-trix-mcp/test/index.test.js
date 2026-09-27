import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { startup, buildContext, main } from '../src/index.js';

const reg = {
  events: [{ slug: 'devfest26', name: 'DevFest 2026', year: 2026, folderId: 'F', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_DEV', active: true }],
  tabsByEvent: { devfest26: { 'General Task': { kind: 'Aktif', entity: 'task', headerRow: 1, columns: { no: 'A', title: 'B' } } } },
};

function tempRegistry() {
  const dir = mkdtempSync(join(tmpdir(), 'ptx-'));
  const path = join(dir, 'planning.json');
  writeFileSync(path, JSON.stringify(reg));
  return path;
}

test('startup ok with valid env', () => {
  const boot = startup({ PTX_SPREADSHEET_ID_DEV: 'SID', PTX_REGISTRY: tempRegistry() });
  assert.equal(boot.ok, true);
  assert.equal(boot.cfg.env, 'dev');
  assert.equal(boot.ctx.meta.env, 'dev');
  assert.equal(boot.ctx.registry.events.length, 1);
  assert.equal(typeof boot.ctx.sheets.getValues, 'function');
});

test('startup fails on bad env', () => {
  const boot = startup({ PTX_ENV: 'staging', PTX_SPREADSHEET_ID_DEV: 'SID' });
  assert.equal(boot.ok, false);
  assert.equal(boot.error.code, 'E_CONFIG');
});

test('startup fails on missing spreadsheet id', () => {
  const boot = startup({});
  assert.equal(boot.ok, false);
  assert.equal(boot.error.code, 'E_CONFIG');
});

test('startup fails on bad registry file', () => {
  const boot = startup({ PTX_SPREADSHEET_ID_DEV: 'SID', PTX_REGISTRY: '/nonexistent/x.json' });
  assert.equal(boot.ok, false);
  assert.equal(boot.error.code, 'E_INTERNAL');
});

test('buildContext merges keyFile from env', () => {
  const cfg = { env: 'dev', spreadsheetId: 'SID', keyFile: null, registryPath: tempRegistry(), readOnly: false };
  const ctx = buildContext(cfg, { PTX_SA_KEY_FILE: '/env/key.json' });
  assert.ok(ctx.registry);
});

test('main connects with injected transport', async () => {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const boot = await main({ PTX_SPREADSHEET_ID_DEV: 'SID', PTX_REGISTRY: tempRegistry() }, { transport: serverT });
  assert.equal(boot.ok, true);
  assert.equal(typeof boot.server.connect, 'function');
  await clientT.close();
  await serverT.close();
});

test('main returns error boot without transport', async () => {
  const boot = await main({ PTX_ENV: 'staging' });
  assert.equal(boot.ok, false);
});
