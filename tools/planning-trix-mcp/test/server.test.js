import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, toolSpecs } from '../src/server.js';
import { makeCtx } from './helpers.js';

async function connected(ctx) {
  const server = buildServer(ctx);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

test('toolSpecs lists 13 tools', () => {
  const specs = toolSpecs();
  assert.equal(specs.length, 13);
  assert.deepEqual(Object.keys(specs[0]).sort(), ['description', 'name', 'shape']);
});

test('server exposes tools over MCP', async () => {
  const client = await connected(makeCtx());
  const list = await client.listTools();
  assert.equal(list.tools.length, 13);
  assert.ok(list.tools.find((t) => t.name === 'budget_summary'));
});

test('server tool call returns json + wa_text', async () => {
  const client = await connected(makeCtx());
  const res = await client.callTool({ name: 'budget_summary', arguments: { event: 'devfest26' } });
  assert.equal(res.isError, false);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.ok, true);
  assert.match(payload.wa_text, /Subtotal/);
});

test('server tool call error sets isError', async () => {
  const client = await connected(makeCtx());
  const res = await client.callTool({ name: 'task_list', arguments: { event: 'nope' } });
  assert.equal(res.isError, true);
  const payload = JSON.parse(res.content[0].text);
  assert.equal(payload.error.code, 'E_EVENT_UNKNOWN');
});
