import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMakeAuth, defaultToken, createSheetsClient } from '../src/infra/sheets/client.js';

const cfg = { spreadsheetId: 'SID', readOnly: false, keyFile: '/k.json' };
const cfgProd = { spreadsheetId: 'SID', readOnly: true, keyFile: null };

test('defaultMakeAuth builds dev and prod auth', () => {
  const a = defaultMakeAuth(cfg);
  assert.equal(typeof a.getClient, 'function');
  const p = defaultMakeAuth(cfgProd);
  assert.equal(typeof p.getClient, 'function');
});

test('defaultToken extracts token', async () => {
  const makeAuth = () => ({ getClient: async () => ({ getAccessToken: async () => ({ token: 'tok' }) }) });
  assert.equal(await defaultToken(cfg, makeAuth), 'tok');
  const plain = () => ({ getClient: async () => ({ getAccessToken: async () => 'tok2' }) });
  assert.equal(await defaultToken(cfg, plain), 'tok2');
  const none = () => ({ getClient: async () => ({ getAccessToken: async () => ({}) }) });
  await assert.rejects(() => defaultToken(cfg, none), /access token/);
});

test('createSheetsClient getValues', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ values: [['a']] }) };
  };
  const client = createSheetsClient(cfg, { getToken: async () => 'tok', fetch });
  assert.deepEqual(await client.getValues('Tab'), [['a']]);
  assert.match(calls[0].url, /values\/Tab\?majorDimension=ROWS/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer tok');
});

test('createSheetsClient getValues default [] and batchGet', async () => {
  const fetch = async (url) => ({
    ok: true,
    json: async () => (url.includes('batchGet')
      ? { valueRanges: [{ values: [['x']] }, {}] }
      : {}),
  });
  const client = createSheetsClient(cfg, { getToken: async () => 't', fetch });
  assert.deepEqual(await client.getValues('Empty'), []);
  const out = await client.batchGet(['A', 'B']);
  assert.deepEqual(out, { A: [['x']], B: [] });
});

test('createSheetsClient maps errors', async () => {
  const fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const client = createSheetsClient(cfg, { getToken: async () => 't', fetch });
  await assert.rejects(() => client.getValues('X'), (e) => e.code === 'E_TAB_NOT_FOUND');
  const fetch500 = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const c2 = createSheetsClient(cfg, { getToken: async () => 't', fetch: fetch500 });
  await assert.rejects(() => c2.getValues('X'), (e) => e.code === 'E_UPSTREAM');
});

test('createSheetsClient defaults (uses global fetch)', () => {
  const client = createSheetsClient(cfgProd);
  assert.equal(typeof client.getValues, 'function');
  assert.equal(typeof client.batchGet, 'function');
});
