import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEnvName, spreadsheetIdFor, loadConfig } from '../src/config/env.js';

test('resolveEnvName', () => {
  assert.equal(resolveEnvName(undefined), 'dev');
  assert.equal(resolveEnvName('  '), 'dev');
  assert.equal(resolveEnvName('DEV'), 'dev');
  assert.equal(resolveEnvName('prod'), 'prod');
  assert.throws(() => resolveEnvName('staging'), /PTX_ENV/);
});

test('spreadsheetIdFor', () => {
  assert.equal(spreadsheetIdFor('dev', { PTX_SPREADSHEET_ID_DEV: 'abc' }), 'abc');
  assert.throws(() => spreadsheetIdFor('prod', {}), /PTX_SPREADSHEET_ID_PROD/);
});

test('loadConfig dev vs prod', () => {
  const dev = loadConfig({ PTX_SPREADSHEET_ID_DEV: 'devsheet', PTX_SA_KEY_FILE: ' /k.json ', PTX_REGISTRY: ' r.json ', PTX_DEFAULT_EVENT: ' devfest26 ' });
  assert.deepEqual(dev, { env: 'dev', spreadsheetId: 'devsheet', keyFile: '/k.json', registryPath: 'r.json', readOnly: false, defaultEvent: 'devfest26' });
  const prod = loadConfig({ PTX_ENV: 'prod', PTX_SPREADSHEET_ID_PROD: 'p' });
  assert.equal(prod.readOnly, true);
  assert.equal(prod.keyFile, null);
  assert.equal(prod.registryPath, 'registry/planning.json');
  assert.equal(prod.defaultEvent, null);
});
