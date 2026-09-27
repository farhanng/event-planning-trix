import test from 'node:test';
import assert from 'node:assert/strict';
import { PtxError, ERROR_CODES, mapUpstreamStatus, toErrorPayload } from '../src/domain/errors.js';

test('PtxError carries code + details', () => {
  const e = new PtxError(ERROR_CODES.E_VALIDATION, 'bad', { a: 1 });
  assert.equal(e.name, 'PtxError');
  assert.equal(e.code, 'E_VALIDATION');
  assert.equal(e.message, 'bad');
  assert.deepEqual(e.details, { a: 1 });
  assert.ok(e instanceof Error);
});

test('mapUpstreamStatus', () => {
  assert.equal(mapUpstreamStatus(401), 'E_AUTH');
  assert.equal(mapUpstreamStatus(403), 'E_AUTH');
  assert.equal(mapUpstreamStatus(404), 'E_TAB_NOT_FOUND');
  assert.equal(mapUpstreamStatus(429), 'E_UPSTREAM');
  assert.equal(mapUpstreamStatus(503), 'E_UPSTREAM');
  assert.equal(mapUpstreamStatus(400), 'E_INTERNAL');
});

test('toErrorPayload', () => {
  assert.deepEqual(toErrorPayload(new PtxError('E_X', 'm', {})), { code: 'E_X', message: 'm', details: {} });
  assert.deepEqual(toErrorPayload(new Error('boom')), { code: 'E_INTERNAL', message: 'boom', details: {} });
  assert.deepEqual(toErrorPayload('str'), { code: 'E_INTERNAL', message: 'str', details: {} });
});
