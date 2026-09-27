import { PtxError, ERROR_CODES } from '../../domain/errors.js';

const WRITE_BLOCKED_KINDS = Object.freeze(['Arsip', 'Draft']);
const VALID_KINDS = Object.freeze(['Aktif', 'Referensi', 'Arsip', 'Draft', 'Turunan']);

export function loadRegistry(json, source = '<inline>') {
  if (!json || typeof json !== 'object') throw new PtxError(ERROR_CODES.E_CONFIG, `Registry ${source} bukan objek JSON`);
  if (!Array.isArray(json.events) || json.events.length === 0) throw new PtxError(ERROR_CODES.E_CONFIG, `Registry ${source} tidak punya events[]`);
  const seen = new Set();
  for (const ev of json.events) {
    if (!ev || !ev.slug) throw new PtxError(ERROR_CODES.E_CONFIG, `Registry ${source}: event tanpa slug`);
    if (seen.has(ev.slug)) throw new PtxError(ERROR_CODES.E_CONFIG, `Registry ${source}: slug duplikat '${ev.slug}'`);
    seen.add(ev.slug);
  }
  return {
    portfolio: json.portfolio ?? null,
    events: json.events,
    tabs: json.tabs ?? {},
    tabsByEvent: json.tabsByEvent ?? {},
    enums: json.enums ?? {},
    source,
  };
}

export function listEvents(registry) {
  return registry.events.map((ev) => ({
    slug: ev.slug,
    name: ev.name ?? ev.slug,
    jenis: ev.jenis ?? null,
    year: ev.year ?? null,
    active: ev.active === true,
    folder_id: ev.folderId ?? null,
    spreadsheet_env: ev.spreadsheetIdEnv ?? null,
    has_registry: Boolean(ev.registryFile),
  }));
}

export function resolveEvent(registry, slug) {
  const key = (slug ?? '').trim();
  if (!key) throw new PtxError(ERROR_CODES.E_EVENT_UNKNOWN, `Parameter event wajib diisi`);
  const event = registry.events.find((ev) => ev.slug === key);
  if (!event) throw new PtxError(ERROR_CODES.E_EVENT_UNKNOWN, `Event '${key}' tidak ada di katalog`, { slug: key });
  return event;
}

export function tabsForEvent(registry, slug) {
  const event = resolveEvent(registry, slug);
  const map = (registry.tabsByEvent ?? {})[slug] ?? event.tabs ?? registry.tabs ?? null;
  if (!map || typeof map !== 'object' || Object.keys(map).length === 0) {
    throw new PtxError(ERROR_CODES.E_CONFIG, `Event '${slug}' tidak punya registry tab`);
  }
  return map;
}

export function findTab(registry, slug, title) {
  const map = tabsForEvent(registry, slug);
  const tab = map[title];
  if (!tab || typeof tab !== 'object' || Array.isArray(tab)) throw new PtxError(ERROR_CODES.E_TAB_NOT_FOUND, `Tab '${title}' tidak terdaftar untuk event '${slug}'`, { slug, title });
  return { title, ...tab };
}

export function isWriteAllowed(tab) {
  const kind = tab?.kind ?? null;
  return !WRITE_BLOCKED_KINDS.includes(kind);
}

export function validateTabKind(tab) {
  const kind = tab?.kind;
  return VALID_KINDS.includes(kind);
}