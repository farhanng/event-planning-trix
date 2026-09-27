import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOLS } from './app/tools/index.js';
import { callTool } from './app/register.js';
import { toMcpResult, toWaText } from './app/output/format.js';

// Server MCP: satu tool MCP per tool domain, output JSON + ringkasan teks.
export function buildServer(ctx) {
  const server = new McpServer({ name: 'planning-trix', version: '0.1.0' });
  for (const [name, spec] of Object.entries(TOOLS)) {
    server.registerTool(
      name,
      { description: spec.description, inputSchema: spec.shape },
      async (args) => {
        const payload = await callTool(name, args, ctx);
        const wa = payload.ok ? toWaText(payload.summary) : null;
        return toMcpResult(wa ? { ...payload, wa_text: wa } : payload);
      },
    );
  }
  return server;
}

export function toolSpecs() {
  return Object.entries(TOOLS).map(([name, spec]) => ({
    name,
    description: spec.description,
    shape: spec.shape,
  }));
}
