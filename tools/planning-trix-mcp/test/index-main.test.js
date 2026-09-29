import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'src', 'index.js');

function spawnServer(env) {
  return spawn(process.execPath, [entry], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function sendLine(child, obj) {
  child.stdin.write(`${JSON.stringify(obj)}\n`);
}

function readLine(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('timeout menunggu respons MCP')), timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    };
    child.stdout.on('data', onData);
  });
}

test('entry runs stdio server when executed directly', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ptx-main-'));
  const regPath = join(dir, 'planning.json');
  writeFileSync(regPath, JSON.stringify({
    events: [{ slug: 'devfest26', name: 'DevFest 2026', year: 2026, folderId: 'F', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_DEV', active: true }],
    tabsByEvent: { devfest26: { 'General Task': { kind: 'Aktif', entity: 'task', headerRow: 1, columns: { no: 'A', title: 'B' } } } },
  }));

  const child = spawnServer({ PTX_SPREADSHEET_ID_DEV: 'SID', PTX_SA_KEY_FILE: '/k.json', PTX_REGISTRY: regPath });
  const stderr = [];
  child.stderr.on('data', (d) => stderr.push(d.toString()));
  try {
    sendLine(child, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    const init = await readLine(child);
    assert.equal(init.result.serverInfo.name, 'planning-trix');
    sendLine(child, { jsonrpc: '2.0', method: 'notifications/initialized' });
    sendLine(child, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const list = await readLine(child);
    assert.equal(list.result.tools.length, 16);
    // Tutup stdin agar stdio transport menutup server -> exit rapi -> v8 coverage ter-flush.
    const exited = new Promise((resolve) => child.on('exit', resolve));
    child.stdin.end();
    assert.equal(await exited, 0);
  } finally {
    if (!child.exitCode && child.exitCode !== 0) child.kill();
  }
});

test('entry exits nonzero on bad config', async () => {
  const child = spawnServer({ PTX_ENV: 'staging' });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 1);
});
