import { z } from 'zod';
import { PtxError, ERROR_CODES, toErrorPayload } from '../domain/errors.js';
import { envelope, errorEnvelope } from './output/format.js';
import { TOOLS } from './tools/index.js';

export function parseArgs(spec, args) {
  const result = z.object(spec.shape).safeParse(args ?? {});
  if (!result.success) {
    throw new PtxError(ERROR_CODES.E_VALIDATION, 'Argumen tidak valid', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

// Satu pintu eksekusi tool: validasi -> handler -> envelope seragam.
export async function callTool(name, args, ctx) {
  const spec = TOOLS[name];
  if (!spec) {
    return errorEnvelope(toErrorPayload(new PtxError(ERROR_CODES.E_INTERNAL, `Tool '${name}' tidak dikenal`)), { env: ctx?.meta?.env ?? null });
  }
  try {
    const parsed = parseArgs(spec, args);
    const data = await spec.run({ ...ctx, args: parsed });
    const meta = {
      env: ctx?.meta?.env ?? null,
      event: parsed.event ?? null,
      rev: ctx?.meta?.rev ?? null,
      source_tabs: data.source_tabs ?? [],
      warnings: data.warnings ?? [],
      conflicts: data.conflicts ?? [],
    };
    return envelope(data, meta, data.summary ?? []);
  } catch (err) {
    return errorEnvelope(toErrorPayload(err), { env: ctx?.meta?.env ?? null });
  }
}
