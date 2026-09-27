import { readFileSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/env.js';
import { loadRegistry } from './infra/registry/registry.js';
import { createSheetsClient } from './infra/sheets/client.js';
import { buildServer } from './server.js';
import { toErrorPayload } from './domain/errors.js';

export function buildContext(cfg, env = process.env) {
  const registry = loadRegistry(JSON.parse(readFileSync(cfg.registryPath, 'utf8')), cfg.registryPath);
  const sheets = createSheetsClient({ ...cfg, keyFile: cfg.keyFile ?? env.PTX_SA_KEY_FILE ?? null });
  return { registry, sheets, meta: { env: cfg.env } };
}

export function startup(env = process.env) {
  try {
    const cfg = loadConfig(env);
    return { ok: true, cfg, ctx: buildContext(cfg, env) };
  } catch (err) {
    return { ok: false, error: toErrorPayload(err) };
  }
}

// Bisa dites tanpa jaringan: transport injectable.
export async function main(env = process.env, deps = {}) {
  const boot = startup(env);
  if (!boot.ok) return boot;
  const server = buildServer(boot.ctx);
  await server.connect(deps.transport ?? new StdioServerTransport());
  return { ok: true, cfg: boot.cfg, server };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const boot = startup();
  if (!boot.ok) {
    process.stderr.write(`planning-trix gagal start: ${JSON.stringify(boot.error)}\n`);
    process.exit(1);
  }
  await main();
  process.stderr.write(`planning-trix MCP jalan (env=${boot.cfg.env})\n`);
}
