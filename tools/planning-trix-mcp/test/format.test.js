import test from 'node:test';
import assert from 'node:assert/strict';
import { envelope, errorEnvelope, toWaText, toMcpResult } from '../src/app/output/format.js';

test('envelope', () => {
  assert.deepEqual(envelope({ a: 1 }, { env: 'dev' }, ['s']), { ok: true, data: { a: 1 }, meta: { env: 'dev' }, summary: ['s'] });
  assert.deepEqual(envelope({}, {}), { ok: true, data: {}, meta: {}, summary: [] });
});

test('errorEnvelope', () => {
  assert.deepEqual(errorEnvelope({ code: 'E_X' }, { env: 'dev' }), { ok: false, error: { code: 'E_X' }, meta: { env: 'dev' } });
});

test('toWaText', () => {
  assert.equal(toWaText(['a', '', null, 'b']), 'a\nb');
  assert.equal(toWaText(null), '');
});

test('toMcpResult', () => {
  const ok = toMcpResult({ ok: true });
  assert.equal(ok.isError, false);
  assert.equal(ok.content[0].type, 'text');
  const bad = toMcpResult({ ok: false });
  assert.equal(bad.isError, true);
  assert.equal(toMcpResult('hi').content[0].text, 'hi');
});
