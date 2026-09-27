import { findTab } from '../../infra/registry/registry.js';
import { mapRows } from './rows.js';

// Baca satu tab lewat registry. Tab Arsip tidak dibaca kecuali diminta eksplisit.
export async function readTab(ctx, title) {
  const tab = findTab(ctx.registry, ctx.args.event, title);
  if (tab.kind === 'Arsip') return { tab, rows: [], skipped: true };
  const values = await ctx.sheets.getValues(title);
  return { tab, rows: mapRows(values, tab), skipped: false };
}

export function tabMeta(tab, warnings = []) {
  return { source_tabs: [tab.title], warnings, conflicts: [] };
}
