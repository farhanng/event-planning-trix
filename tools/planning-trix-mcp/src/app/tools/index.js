import { z } from 'zod';
import { listEvents, tabsForEvent, isWriteAllowed, findTab } from '../../infra/registry/registry.js';
import { readTab } from './read.js';
import { cellAt, colToIndex } from './rows.js';
import { clean, toInt, toMoney, toIsoDate, toPhone } from '../../domain/normalize.js';
import { mapStatus, mapEnum, ENUMS } from '../../domain/enums.js';
import { sumBy, uniqueBy } from '../../domain/aggregate.js';
import { PtxError, ERROR_CODES } from '../../domain/errors.js';

const event = z.string().min(1);
const lower = (v) => (v ?? '').toString().trim().toLowerCase();
const contains = (hay, needle) => lower(hay).includes(lower(needle));

// Baris ringkasan di dalam tab detail (mis. "Subtotal A", "TOTAL BELANJA").
const AGG_RE = /^(subtotal|total|grand total)\b/i;
// Awal blok yang bukan lagi detail: agregat, posisi dana, skenario, catatan.
const MARKER_RE = /^(total|subtotal|grand total|posisi|skenario|catatan|benefit|usulan|paket lama|budget buffer|kebutuhan|gap|in - out)\b/i;
// Baris In-Out yang bukan pengeluaran nyata (agregat / buffer cadangan).
const ENTRY_MARKER_RE = /^(total|subtotal|posisi|gap|in - out|buffer)\b/i;
const isBufferEntry = (e) => /^buffer\b/i.test(e.source ?? '');
const isDetailEntry = (e) => (e.type === 'In' || e.type === 'Out') && e.nominal_idr != null && !ENTRY_MARKER_RE.test(e.source ?? '');

// Ambil baris detail sampai marker ringkasan/section pertama. Baris lanjutan (key kosong) tetap ikut.
function takeDetails(rows, keyField) {
  const out = [];
  for (const r of rows) {
    const key = r[keyField];
    if (key == null) { out.push(r); continue; }
    if (MARKER_RE.test(String(key))) break;
    out.push(r);
  }
  return out;
}

// Nama tab kanonik (harus sama dengan registry/planning.json).
export const TABS = Object.freeze({
  budgetLines: 'Budget 2026 (Draft)',
  budgetEntries: 'Budget 2026 - In Out',
  tickets: 'Tiket 2026 (Draft)',
  sponsorPackages: 'Paket Sponsor 2026 (Draft)',
  generalTask: 'General Task',
  designTask: 'Design Task',
  objectives: 'Objectives',
  committee: 'Commitee',
  volunteers: 'Final New Volunteer',
  potentialVolunteer: 'Potential Volunteer',
  speakers: '[LO] Speakers Candidate',
  partnership: 'Target Partnership',
  mediaPartner: 'MEDIA PARTNER',
  logisticNeeds: 'LOGISTIC - NEEDS',
  loRoster: 'Job on Stage 2026 (Clean)',
});

const DRAFT_SCENARIO = 'draft';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Guard tulis: tab harus writeable + environment harus dev (prod selalu read-only).
function assertWritable(ctx, title) {
  const tab = findTab(ctx.registry, ctx.args.event, title);
  if (!isWriteAllowed(tab)) {
    throw new PtxError(ERROR_CODES.E_WRITE_FORBIDDEN, `Tab '${title}' tidak boleh ditulis (kind Arsip/Draft)`, { title, kind: tab.kind });
  }
  if (ctx.meta?.env !== 'dev' || ctx.meta?.readOnly === true) {
    throw new PtxError(ERROR_CODES.E_WRITE_FORBIDDEN, 'Tulis hanya diizinkan di environment dev', { env: ctx.meta?.env ?? null, read_only: ctx.meta?.readOnly === true });
  }
  return tab;
}

// Peta baris mentah -> objek + nomor baris absolut (untuk update sel).
function mapRowsWithRow(values, tab) {
  const headerRow = Number(tab.headerRow) || 1;
  const cols = Object.entries(tab.columns ?? {}).filter(([, c]) => typeof c === 'string' && c);
  const out = [];
  (Array.isArray(values) ? values : []).slice(headerRow).forEach((row, i) => {
    const obj = {};
    for (const [field, col] of cols) obj[field] = cellAt(row, col);
    if (Object.values(obj).some((v) => v != null && String(v).trim() !== '')) out.push({ row: headerRow + i + 1, obj });
  });
  return out;
}

// Objek -> array sel sesuai urutan kolom tab (untuk append/update).
function rowToValues(tab, obj) {
  const entries = Object.entries(tab.columns ?? {}).filter(([, c]) => typeof c === 'string' && c);
  let max = -1;
  for (const [, col] of entries) {
    const idx = colToIndex(col);
    if (idx != null) max = Math.max(max, idx);
  }
  const out = new Array(max + 1).fill('');
  for (const [field, col] of entries) {
    const idx = colToIndex(col);
    if (idx == null) continue;
    const v = obj[field];
    out[idx] = v == null ? '' : v;
  }
  return out;
}

function nextNumber(items, numField = 'no') {
  let max = 0;
  for (const it of items) {
    const n = toInt(it?.[numField]);
    if (n != null && n > max) max = n;
  }
  return max + 1;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Status bayar pada LOGISTIC lama dan pada "In Out" memakai kosakata beda.
function mapPayment(raw) {
  const m = mapStatus(raw);
  return m.status === 'unknown' ? mapEnum(raw, ENUMS.payment) : m.status;
}

export function taskRow(row) {
  const rawStatus = clean(row.status);
  const m = mapStatus(rawStatus);
  const deadline = clean(row.due_date);
  const assigned = m.status !== 'unknown' || deadline != null;
  return {
    id: clean(row.id) ?? clean(row.no),
    title: clean(row.title),
    priority: mapEnum(row.priority, ENUMS.prioritas),
    pic: clean(row.pic),
    status: m.status,
    raw_status: rawStatus,
    due_date: toIsoDate(deadline),
    note: clean(row.note),
    data_valid: assigned,
    status_valid: m.status !== 'unknown',
  };
}

export function ticketRow(row) {
  const price = toMoney(row.price_idr);
  const pax = toInt(row.pax);
  return {
    tier: clean(row.tier), includes: clean(row.includes), price_idr: price, pax,
    packages: clean(row.packages),
    total_idr: toMoney(row.total_idr) ?? (price != null && pax != null ? price * pax : null),
    note: clean(row.note),
  };
}

export function budgetLine(row) {
  const qty = toInt(row.qty);
  const unit = toMoney(row.unit_price_idr);
  return {
    category: clean(row.category), item: clean(row.item), qty, unit: clean(row.unit),
    unit_price_idr: unit,
    total_idr: toMoney(row.total_idr) ?? (qty != null && unit != null ? qty * unit : null),
    note: clean(row.note),
  };
}

export function budgetEntry(row) {
  const rawType = clean(row.type);
  const t = lower(rawType);
  // Hanya 'IN'/'OUT' yang dianggap entri; baris POSISI/SKENARIO/CATATAN -> null (tidak dihitung).
  const type = t === 'in' ? 'In' : (t === 'out' ? 'Out' : null);
  return {
    type, source: clean(row.source), nominal_idr: toMoney(row.nominal_idr),
    status: mapPayment(row.status_raw), raw_status: clean(row.status_raw), note: clean(row.note),
  };
}

export function sponsorPackageRow(row) {
  const slot = toInt(row.slot);
  const price = toMoney(row.price_idr);
  return {
    package: clean(row.package), slot, price_idr: price,
    potential_total_idr: toMoney(row.potential_total_idr) ?? (slot != null && price != null ? slot * price : null),
    note: clean(row.note),
  };
}

export function designTaskRow(row) {
  const m = mapStatus(row.status);
  return {
    design: clean(row.design), type: clean(row.type), designer: clean(row.designer),
    status: m.status, raw_status: m.raw_status, deadline: toIsoDate(row.deadline),
    note: clean(row.note),
  };
}

export function objectiveRow(row) {
  return {
    objective: clean(row.objective), key_result: clean(row.key_result), sie: clean(row.sie),
    metric: clean(row.metric), target: clean(row.target),
    value: toInt(row.value), percentage: clean(row.percentage),
  };
}

export function dealRow(row, tipe) {
  const expectedUsd = toMoney(row.expected_usd);
  return {
    company: clean(row.company), tipe, pic: clean(row.pic),
    expected_usd: expectedUsd,
    status: mapEnum(row.status, ENUMS.statusKontak), raw_status: clean(row.status),
    contact: clean(row.contact_person) ?? clean(row.contact),
    phone: toPhone(row.phone), email: clean(row.email),
  };
}

export function speakerRow(row) {
  const raw = clean(row.status);
  const m = mapStatus(raw);
  // Kolom status speaker memakai kosakata pipeline kontak (Belum Dikontak/Dihubungi/...).
  const status = m.status === 'unknown' ? mapEnum(raw, ENUMS.statusKontak) : m.status;
  return {
    name: clean(row.name) ?? clean(row.person_name), topic: clean(row.topic),
    role: clean(row.role_title), pic: clean(row.contact_pic),
    status, raw_status: raw, notes: clean(row.notes),
  };
}

export function potentialVolunteerRow(row) {
  const raw = clean(row.status);
  return {
    no: clean(row.no), name: clean(row.name), division: clean(row.division),
    role: clean(row.role), email: clean(row.email), phone: toPhone(row.phone),
    occupation: clean(row.occupation), source: clean(row.source),
    status: raw == null ? 'Baru' : mapEnum(raw, ENUMS.potentialStatus),
    raw_status: raw,
    note: clean(row.note),
    promoted_at: toIsoDate(row.promoted_at) ?? clean(row.promoted_at),
  };
}

export function organizerRow(row, tipe) {
  return {
    name: clean(row.name), email: clean(row.email),
    phone: toPhone(row.phone) ?? toPhone(row.contact),
    division: clean(row.division),
    role: clean(row.role) ?? clean(row.day_role) ?? clean(row.pre_day_role),
    tipe,
  };
}

export function logisticRow(row) {
  const qty = toInt(row.quantity);
  return {
    division: clean(row.division), item: clean(row.item), quantity: qty,
    notes: clean(row.notes), status_bayar: mapPayment(row.status),
  };
}

export function loRow(row) {
  return {
    no: clean(row.no), name: clean(row.name), contact: toPhone(row.contact) ?? clean(row.contact),
    origin: clean(row.origin), role: clean(row.role), status: clean(row.status), note: clean(row.note),
  };
}

export const TOOLS = {
  event_catalog: {
    description: 'Katalog event lintas tahun (slug, nama, folder, file).',
    shape: { year: z.number().int().optional(), jenis: z.string().optional() },
    run: async (ctx) => {
      const { year, jenis } = ctx.args;
      let events = listEvents(ctx.registry);
      if (year != null) events = events.filter((e) => e.year === year);
      if (jenis) events = events.filter((e) => lower(e.jenis) === lower(jenis));
      return { events, count: events.length, summary: events.map((e) => `${e.slug} | ${e.name} | ${e.year ?? '-'}`) };
    },
  },

  planning_index: {
    description: 'Daftar tab per event: kind, entitas, status tulis.',
    shape: { event, kind: z.string().optional() },
    run: async (ctx) => {
      const map = tabsForEvent(ctx.registry, ctx.args.event);
      let tabs = Object.entries(map)
        .filter(([, t]) => t && typeof t === 'object' && !Array.isArray(t))
        .map(([title, t]) => ({
          title, kind: t.kind ?? 'Aktif', entity: t.entity ?? null,
          vintage: t.vintage ?? null, derived_from: t.derivedFrom ?? null,
          read_by: t.entity ? 'tool' : null, write_allowed: isWriteAllowed(t),
        }));
      if (ctx.args.kind) tabs = tabs.filter((t) => lower(t.kind) === lower(ctx.args.kind));
      return {
        tabs, count: tabs.length,
        summary: tabs.map((t) => `${t.title} [${t.kind}]`),
      };
    },
  },

  budget_summary: {
    description: 'Anggaran draft: baris budget, pemasukan/pengeluaran, subtotal, gap.',
    shape: { event, scenario: z.string().optional() },
    run: async (ctx) => {
      const rawLines = (await readTab(ctx, TABS.budgetLines)).rows;
      // Hanya blok belanja, dan hanya baris detail (bukan Subtotal/TOTAL/pemasukan/catatan).
      let section = 'belanja';
      const lines = [];
      for (const l of rawLines) {
        const cat = l.category ?? '';
        if (/^pemasukan/i.test(cat)) { section = 'pemasukan'; continue; }
        if (/^catatan/i.test(cat)) { section = 'catatan'; continue; }
        if (section !== 'belanja' || !l.item || AGG_RE.test(l.item)) continue;
        lines.push(budgetLine(l));
      }
      const allEntries = (await readTab(ctx, TABS.budgetEntries)).rows.map(budgetEntry);
      const entries = allEntries.filter(isDetailEntry);
      const buffer_idr = sumBy(allEntries.filter(isBufferEntry), 'nominal_idr');
      const subtotal_idr = sumBy(lines, 'total_idr');
      const income = entries.filter((e) => e.type === 'In');
      const expense = entries.filter((e) => e.type === 'Out');
      const income_idr = sumBy(income, 'nominal_idr');
      const expense_idr = sumBy(expense, 'nominal_idr');
      const total_out_idr = expense_idr + buffer_idr;
      const gap_idr = income_idr - total_out_idr;
      const conflicts = [];
      if (subtotal_idr !== expense_idr && expense_idr > 0 && subtotal_idr > 0) {
        conflicts.push({ field: 'subtotal_idr', values: [subtotal_idr, expense_idr], source_tabs: [TABS.budgetLines, TABS.budgetEntries] });
      }
      return {
        lines, entries, subtotal_idr, income_idr, total_out_idr, buffer_idr, gap_idr, conflicts,
        scenario: DRAFT_SCENARIO,
        warnings: ['Angka dari tab berlabel (Draft): belum final, jangan dipakai sebagai acuan tunggal.'],
        source_tabs: [TABS.budgetLines, TABS.budgetEntries],
        summary: [
          `Subtotal belanja: Rp${subtotal_idr.toLocaleString('id-ID')}`,
          `Buffer: Rp${buffer_idr.toLocaleString('id-ID')}`,
          `Gap sponsor: Rp${Math.abs(gap_idr).toLocaleString('id-ID')}`,
        ],
      };
    },
  },

  ticket_summary: {
    description: 'Tier tiket (draft): harga, packages, pax, total.',
    shape: { event },
    run: async (ctx) => {
      const tiers = takeDetails((await readTab(ctx, TABS.tickets)).rows, 'tier').map(ticketRow);
      const total_ticket_idr = sumBy(tiers, 'total_idr');
      const pax = sumBy(tiers, 'pax');
      return {
        tiers, total_ticket_idr, total_pax: pax,
        avg_per_pax_idr: pax > 0 ? Math.round(total_ticket_idr / pax) : null,
        warnings: ['Tier tiket berlabel (Draft).'],
        source_tabs: [TABS.tickets],
        summary: tiers.map((t) => `${t.tier}: Rp${t.price_idr ?? 0} x ${t.pax ?? 0}`),
      };
    },
  },

  partnership_pipeline: {
    description: 'Pipeline sponsor + media partner (satu entitas deal).',
    shape: { event, tipe: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      const sp = (await readTab(ctx, TABS.partnership)).rows.map((r) => dealRow(r, 'Sponsor'));
      const mp = (await readTab(ctx, TABS.mediaPartner)).rows.map((r) => dealRow(r, 'Media Partner'));
      let deals = [...sp, ...mp];
      if (ctx.args.tipe) deals = deals.filter((d) => lower(d.tipe) === lower(ctx.args.tipe));
      if (ctx.args.status) deals = deals.filter((d) => lower(d.status) === lower(ctx.args.status) || lower(d.raw_status) === lower(ctx.args.status));
      return {
        deals, count: deals.length,
        expected_usd: sumBy(deals, 'expected_usd'),
        source_tabs: [TABS.partnership, TABS.mediaPartner],
        summary: deals.map((d) => `${d.company} (${d.tipe}) - ${d.raw_status ?? d.status}`),
      };
    },
  },

  speaker_packages: {
    description: 'Paket sponsor (draft): harga, slot, potensi total.',
    shape: { event },
    run: async (ctx) => {
      const packages = takeDetails((await readTab(ctx, TABS.sponsorPackages)).rows, 'package').map(sponsorPackageRow);
      return {
        packages, count: packages.length,
        potential_total_idr: sumBy(packages, 'potential_total_idr'),
        warnings: ['Paket sponsor berlabel (Draft).'],
        source_tabs: [TABS.sponsorPackages],
        summary: packages.map((p) => `${p.package}: Rp${p.price_idr ?? 0} x ${p.slot ?? '-'}`),
      };
    },
  },

  speaker_candidates: {
    description: 'Kandidat speaker + status kontak.',
    shape: { event, status: z.string().optional(), pic: z.string().optional() },
    run: async (ctx) => {
      let candidates = (await readTab(ctx, TABS.speakers)).rows.map(speakerRow);
      if (ctx.args.status) candidates = candidates.filter((c) => lower(c.status) === lower(ctx.args.status) || lower(c.raw_status) === lower(ctx.args.status));
      if (ctx.args.pic) candidates = candidates.filter((c) => contains(c.pic, ctx.args.pic));
      return {
        candidates, count: candidates.length,
        source_tabs: [TABS.speakers],
        summary: candidates.map((c) => `${c.name} - ${c.raw_status ?? c.status}`),
      };
    },
  },

  task_list: {
    description: 'Task + PIC + deadline + status enum.',
    shape: { event, pic: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      let tasks = (await readTab(ctx, TABS.generalTask)).rows.map(taskRow);
      if (ctx.args.pic) tasks = tasks.filter((t) => contains(t.pic, ctx.args.pic));
      if (ctx.args.status) tasks = tasks.filter((t) => lower(t.status) === lower(ctx.args.status) || lower(t.raw_status) === lower(ctx.args.status));
      return {
        tasks, count: tasks.length,
        valid: tasks.filter((t) => t.data_valid).length,
        source_tabs: [TABS.generalTask],
        summary: tasks.map((t) => `${t.title} | ${t.pic ?? 'TBD'} | ${t.status} | ${t.due_date ?? 'TBD'}`),
      };
    },
  },

  design_tasks: {
    description: 'Task desain + designer + status + deadline.',
    shape: { event, designer: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      let tasks = (await readTab(ctx, TABS.designTask)).rows.map(designTaskRow);
      if (ctx.args.designer) tasks = tasks.filter((t) => contains(t.designer, ctx.args.designer));
      if (ctx.args.status) tasks = tasks.filter((t) => lower(t.status) === lower(ctx.args.status) || lower(t.raw_status) === lower(ctx.args.status));
      return {
        tasks, count: tasks.length,
        source_tabs: [TABS.designTask],
        summary: tasks.map((t) => `${t.design} | ${t.designer ?? '-'} | ${t.status} | ${t.deadline ?? 'TBD'}`),
      };
    },
  },

  objectives: {
    description: 'Objective + key result + sie + target + capaian.',
    shape: { event, sie: z.string().optional() },
    run: async (ctx) => {
      let items = (await readTab(ctx, TABS.objectives)).rows.map(objectiveRow);
      if (ctx.args.sie) items = items.filter((o) => contains(o.sie, ctx.args.sie));
      return {
        items, count: items.length,
        source_tabs: [TABS.objectives],
        summary: items.map((o) => `${o.key_result ?? o.objective} | ${o.sie ?? '-'} | ${o.percentage ?? '-'}`),
      };
    },
  },

  organizer_list: {
    description: 'Panitia + volunteer (satu entitas, dedup).',
    shape: { event, division: z.string().optional(), tipe: z.string().optional() },
    run: async (ctx) => {
      const committee = (await readTab(ctx, TABS.committee)).rows.map((r) => organizerRow(r, 'Committee'));
      const volunteer = (await readTab(ctx, TABS.volunteers)).rows.map((r) => organizerRow(r, 'Volunteer'));
      let organizers = uniqueBy([...committee, ...volunteer], (o) => lower(o.email) || lower(o.name));
      if (ctx.args.division) organizers = organizers.filter((o) => contains(o.division, ctx.args.division));
      if (ctx.args.tipe) organizers = organizers.filter((o) => lower(o.tipe) === lower(ctx.args.tipe));
      return {
        organizers, count: organizers.length,
        with_phone: organizers.filter((o) => o.phone).length,
        source_tabs: [TABS.committee, TABS.volunteers],
        summary: organizers.map((o) => `${o.name} | ${o.tipe} | ${o.division ?? '-'}`),
      };
    },
  },

  logistic_needs: {
    description: 'Kebutuhan logistik (per divisi) + status pengadaan.',
    shape: { event, division: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      let needs = (await readTab(ctx, TABS.logisticNeeds)).rows.map(logisticRow);
      if (ctx.args.division) needs = needs.filter((n) => contains(n.division, ctx.args.division));
      if (ctx.args.status) needs = needs.filter((n) => lower(n.status_bayar) === lower(ctx.args.status));
      return {
        needs, count: needs.length,
        summary: needs.map((n) => `${n.item} x${n.quantity ?? 0} - ${n.status_bayar}`),
      };
    },
  },

  lo_roster: {
    description: 'Roster LO (liaison officer) hari-H: peran + kontak.',
    shape: { event, role: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      let items = (await readTab(ctx, TABS.loRoster)).rows.map(loRow);
      if (ctx.args.role) items = items.filter((l) => contains(l.role, ctx.args.role));
      if (ctx.args.status) items = items.filter((l) => lower(l.status) === lower(ctx.args.status));
      return {
        items, count: items.length,
        source_tabs: [TABS.loRoster],
        summary: items.map((l) => `${l.name} | ${l.role ?? '-'} | ${l.status ?? '-'}`),
      };
    },
  },

  list_potential_volunteers: {
    description: 'Pool calon volunteer (belum dipromosikan) + filter divisi/status.',
    shape: { event, division: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      const tab = findTab(ctx.registry, ctx.args.event, TABS.potentialVolunteer);
      const values = await ctx.sheets.getValues(TABS.potentialVolunteer);
      let items = mapRowsWithRow(values, tab).map(({ row, obj }) => ({ row, ...potentialVolunteerRow(obj) }));
      if (ctx.args.division) items = items.filter((v) => contains(v.division, ctx.args.division));
      if (ctx.args.status) items = items.filter((v) => lower(v.status) === lower(ctx.args.status) || lower(v.raw_status ?? '') === lower(ctx.args.status));
      return {
        items, count: items.length,
        not_promoted: items.filter((v) => v.status !== 'Dipromosikan').length,
        source_tabs: [TABS.potentialVolunteer],
        summary: items.map((v) => `${v.name ?? '-'} | ${v.division ?? '-'} | ${v.status}`),
      };
    },
  },

  add_potential_volunteer: {
    description: 'Tambah calon volunteer ke pool (append, dev-only).',
    shape: {
      event, name: z.string().min(1), division: z.string().min(1),
      role: z.string().optional(), email: z.string().optional(), phone: z.string().optional(),
      occupation: z.string().optional(), source: z.string().optional(), note: z.string().optional(),
    },
    run: async (ctx) => {
      const a = ctx.args;
      assertWritable(ctx, TABS.potentialVolunteer);
      const tab = findTab(ctx.registry, ctx.args.event, TABS.potentialVolunteer);
      const values = await ctx.sheets.getValues(TABS.potentialVolunteer);
      const existing = mapRowsWithRow(values, tab).map(({ obj }) => potentialVolunteerRow(obj));
      const email = clean(a.email);
      const phone = toPhone(a.phone);
      if (email && !EMAIL_RE.test(email)) {
        throw new PtxError(ERROR_CODES.E_VALIDATION, 'Format email tidak valid', { field: 'email', value: email });
      }
      const dupEmail = email ? existing.find((v) => lower(v.email) === lower(email)) : null;
      const dupPhone = phone ? existing.find((v) => v.phone === phone) : null;
      const dup = dupEmail ?? dupPhone;
      if (dup) {
        throw new PtxError(ERROR_CODES.E_VALIDATION, 'Calon volunteer sudah ada di pool (email/HP sama)', { field: dupEmail ? 'email' : 'phone', existing: dup.name });
      }
      const row = rowToValues(tab, {
        no: nextNumber(existing), name: clean(a.name), division: clean(a.division), role: clean(a.role),
        email, phone, occupation: clean(a.occupation), source: clean(a.source), status: 'Baru',
        note: clean(a.note), promoted_at: '',
      });
      const res = await ctx.sheets.appendValues(TABS.potentialVolunteer, [row]);
      return {
        added: { name: clean(a.name), division: clean(a.division), role: clean(a.role), email, phone, status: 'Baru' },
        updated_range: res.updatedRange,
        source_tabs: [TABS.potentialVolunteer],
        warnings: ['Tulis hanya di environment dev.'],
        summary: [`+ ${clean(a.name)} | ${clean(a.division)} | Baru`],
      };
    },
  },

  promote_volunteer: {
    description: 'Promosikan calon volunteer ke Final New Volunteer (dev-only).',
    shape: { event, name: z.string().min(1), target_status: z.string().optional() },
    run: async (ctx) => {
      const a = ctx.args;
      assertWritable(ctx, TABS.volunteers);
      const targetStatus = a.target_status == null ? null : mapEnum(a.target_status, ENUMS.potentialStatus);
      if (a.target_status != null && targetStatus === 'unknown') {
        throw new PtxError(ERROR_CODES.E_VALIDATION, 'target_status tidak dikenal', { allowed: ENUMS.potentialStatus });
      }
      const pool = findTab(ctx.registry, ctx.args.event, TABS.potentialVolunteer);
      const values = await ctx.sheets.getValues(TABS.potentialVolunteer);
      const entries = mapRowsWithRow(values, pool).map((e) => ({ row: e.row, v: potentialVolunteerRow(e.obj) }));
      const hit = entries.find(({ v }) => lower(v.name) === lower(clean(a.name)));
      if (!hit) throw new PtxError(ERROR_CODES.E_TAB_NOT_FOUND, `Calon '${a.name}' tidak ada di pool`, { name: a.name });
      if (hit.v.status === 'Dipromosikan') {
        throw new PtxError(ERROR_CODES.E_VALIDATION, 'Calon ini sudah dipromosikan', { name: hit.v.name });
      }
      const finalTab = findTab(ctx.registry, ctx.args.event, TABS.volunteers);
      const finalValues = await ctx.sheets.getValues(TABS.volunteers);
      const finalEntries = mapRowsWithRow(finalValues, finalTab);
      const finalRows = finalEntries.map(({ obj }) => organizerRow(obj, 'Volunteer'));
      const already = finalRows.find((o) => (hit.v.email && lower(o.email) === lower(hit.v.email)) || (hit.v.phone && o.phone === hit.v.phone));
      if (already) {
        throw new PtxError(ERROR_CODES.E_VALIDATION, 'Sudah ada di Final New Volunteer (email/HP sama)', { existing: already.name });
      }
      const newRow = rowToValues(finalTab, {
        no: nextNumber(finalEntries.map((e) => e.obj)), name: hit.v.name, division: hit.v.division, role: hit.v.role,
        email: hit.v.email, phone: hit.v.phone, occupation: hit.v.occupation,
      });
      await ctx.sheets.appendValues(TABS.volunteers, [newRow]);
      const stamp = todayIso();
      await ctx.sheets.updateValues(
        `'${TABS.potentialVolunteer}'!${pool.columns.status}${hit.row}:${pool.columns.promoted_at}${hit.row}`,
        [[targetStatus ?? 'Dipromosikan', hit.v.note ?? '', stamp]],
      );
      return {
        promoted: { name: hit.v.name, division: hit.v.division, role: hit.v.role, status: targetStatus ?? 'Dipromosikan', promoted_at: stamp },
        source_tabs: [TABS.potentialVolunteer, TABS.volunteers],
        warnings: ['Tulis hanya di environment dev.'],
        summary: [`${hit.v.name} -> Final New Volunteer (${targetStatus ?? 'Dipromosikan'})`],
      };
    },
  },
};