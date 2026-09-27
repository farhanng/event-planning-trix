import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStatus, mapEnum, ENUMS, STATUS_MAP } from '../src/domain/enums.js';

test('mapStatus maps legacy values', () => {
  assert.deepEqual(mapStatus('Done'), { status: 'Selesai', raw_status: 'Done' });
  assert.equal(mapStatus('In-Progress').status, 'Proses');
  assert.equal(mapStatus('TBC').status, 'Belum Mulai');
  assert.equal(mapStatus('LUNAS').status, 'Lunas');
  assert.equal(mapStatus('Blocked').status, 'Terblokir');
  assert.equal(mapStatus('Cancel').status, 'Batal');
  assert.equal(mapStatus('Todo').status, 'Belum Mulai');
});

test('mapStatus passthrough canonical + unknown fallback', () => {
  assert.deepEqual(mapStatus('Proses'), { status: 'Proses', raw_status: 'Proses' });
  assert.deepEqual(mapStatus('  '), { status: 'unknown', raw_status: null });
  assert.deepEqual(mapStatus('Weird'), { status: 'unknown', raw_status: 'Weird' });
  assert.equal(mapStatus(null).status, 'unknown');
});

test('mapEnum', () => {
  assert.equal(mapEnum('high', ENUMS.prioritas), 'High');
  assert.equal(mapEnum('Main hall', ENUMS.zona), 'Main Hall');
  assert.equal(mapEnum(null, ENUMS.zona), 'unknown');
  assert.equal(mapEnum('zzz', ENUMS.zona), 'unknown');
  assert.equal(mapEnum('x'), 'unknown');
  assert.ok(STATUS_MAP['done']);
});
