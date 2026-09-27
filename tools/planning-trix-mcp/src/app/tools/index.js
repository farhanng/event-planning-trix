import { z } from 'zod';
import { listEvents, tabsForEvent, isWriteAllowed } from '../../infra/registry/registry.js';
import { readTab } from './read.js';
import { clean, toInt, toMoney, toIsoDate, toPhone } from '../../domain/normalize.js';
import { mapStatus, mapEnum, ENUMS } from '../../domain/enums.js';
import { sumBy, uniqueBy } from '../../domain/aggregate.js';

const event = z.string().min(1);
const lower = (v) => (v ?? '').toString().trim().toLowerCase();
const contains = (hay, needle) => lower(hay).includes(lower(needle));

export function taskRow(row) {
  const m = mapStatus(row.status);
  return {
    id: clean(row.id) ?? clean(row.no), title: clean(row.title),
    priority: mapEnum(row.priority, ENUMS.prioritas), pic: clean(row.pic) ?? 'TBD',
    status: m.status, raw_status: m.raw_status, due_date: toIsoDate(row.due_date),
    note: clean(row.note),
  };
}

export function ticketRow(row) {
  const price = toMoney(row.price_idr); const pax = toInt(row.pax);
  return {
    tier: clean(row.tier), includes: clean(row.includes), price_idr: price, pax,
    total_idr: toMoney(row.total_idr) ?? (price != null && pax != null ? price * pax : null),
    note: clean(row.note),
  };
}

export function budgetLine(row) {
  const qty = toInt(row.qty); const unit = toMoney(row.unit_price_idr);
  return {
    category: clean(row.category), item: clean(row.item), qty, unit_price_idr: unit,
    total_idr: toMoney(row.total_idr) ?? (qty != null && unit != null ? qty * unit : null),
    note: clean(row.note),
  };
}

export function dealRow(row, tipe) {
  return {
    company: clean(row.company), tipe,
    pic: clean(row.pic), expected_idr: toMoney(row.expected_idr),
    status: mapEnum(row.status, ENUMS.statusKontak),
    contact: clean(row.contact_person) ?? clean(row.contact),
  };
}

export function speakerRow(row) {
  const m = mapStatus(row.status);
  return {
    name: clean(row.person_name) ?? clean(row.name), topic: clean(row.topic),
    role: clean(row.role_title), pic: clean(row.contact_pic),
    status: m.status, raw_status: m.raw_status, notes: clean(row.note),
  };
}

export function organizerRow(row, tipe) {
  return {
    name: clean(row.name), email: clean(row.email),
    phone: toPhone(row.phone) ?? toPhone(row.contact), tipe,
    division: clean(row.division), role: clean(row.role) ?? clean(row.day_role),
  };
}

export function logisticRow(row) {
  const qty = toInt(row.qty); const unit = toMoney(row.unit_price_idr);
  return {
    no: clean(row.no), item: clean(row.item), vendor: clean(row.vendor), qty, unit_price_idr: unit,
    total_idr: toMoney(row.total_idr) ?? (qty != null && unit != null ? qty * unit : null),
    status_bayar: mapEnum(row.status_bayar, ENUMS.payment),
    pic: clean(row.pic) ?? 'TBD',
  };
}

export function agendaRow(row) {
  return {
    zona: mapEnum(row.zona, ENUMS.zona), start: clean(row.start), end: clean(row.end),
    format: clean(row.format), speaker: clean(row.speaker), note: clean(row.note),
  };
}

export function riskRow(row) {
  const p = toInt(row.probability); const i = toInt(row.impact);
  return {
    id: clean(row.id), description: clean(row.description), probability: p, impact: i,
    score: p != null && i != null ? p * i : null,
    mitigation: clean(row.mitigation), owner: clean(row.owner),
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
          derived_from: t.derivedFrom ?? null, write_allowed: isWriteAllowed(t),
        }));
      if (ctx.args.kind) tabs = tabs.filter((t) => lower(t.kind) === lower(ctx.args.kind));
      return {
        tabs, count: tabs.length,
        summary: tabs.map((t) => `${t.title} [${t.kind}]`),
      };
    },
  },

  budget_summary: {
    description: 'Baris budget, subtotal, pemasukan, pengeluaran, gap.',
    shape: { event, scenario: z.string().optional() },
    run: async (ctx) => {
      const lines = (await readTab(ctx, 'Budget 2026 (Draft)')).rows.map(budgetLine);
      const entries = (await readTab(ctx, 'Budget 2026 - In Out')).rows.map((r) => ({
        type: clean(r.type), source: clean(r.source),
        nominal_idr: toMoney(r.nominal_idr), status: mapEnum(r.status, ENUMS.payment),
      }));
      const subtotal_idr = sumBy(lines, 'total_idr');
      const income = entries.filter((e) => lower(e.type).startsWith('in'));
      const expense = entries.filter((e) => !lower(e.type).startsWith('in'));
      const income_idr = sumBy(income, 'nominal_idr');
      const total_out_idr = sumBy(expense, 'nominal_idr');
      const gap_idr = income_idr - total_out_idr;
      const conflicts = [];
      if (subtotal_idr !== total_out_idr && total_out_idr > 0) {
        conflicts.push({ field: 'total_out_idr', values: [subtotal_idr, total_out_idr], source_tabs: ['Budget 2026 (Draft)', 'Budget 2026 - In Out'] });
      }
      return {
        lines, entries, subtotal_idr, income_idr, total_out_idr, gap_idr, conflicts,
        source_tabs: ['Budget 2026 (Draft)', 'Budget 2026 - In Out'],
        summary: [`Subtotal: Rp${subtotal_idr.toLocaleString('id-ID')}`, `Gap: Rp${gap_idr.toLocaleString('id-ID')}`],
      };
    },
  },

  ticket_summary: {
    description: 'Tier tiket: harga, pax, total.',
    shape: { event },
    run: async (ctx) => {
      const tiers = (await readTab(ctx, 'Tiket 2026 (Draft)')).rows.map(ticketRow);
      const total_ticket_idr = sumBy(tiers, 'total_idr');
      const pax = sumBy(tiers, 'pax');
      return {
        tiers, total_ticket_idr, total_pax: pax,
        avg_per_pax_idr: pax > 0 ? Math.round(total_ticket_idr / pax) : null,
        summary: tiers.map((t) => `${t.tier}: Rp${t.price_idr ?? 0} x ${t.pax ?? 0}`),
      };
    },
  },

  partnership_pipeline: {
    description: 'Paket sponsor + deal (sponsor/media partner/community).',
    shape: { event, tipe: z.string().optional() },
    run: async (ctx) => {
      const sp = (await readTab(ctx, 'Target Partnership')).rows.map((r) => dealRow(r, 'Sponsor'));
      const mp = (await readTab(ctx, 'MEDIA PARTNER')).rows.map((r) => dealRow(r, 'Media Partner'));
      let deals = [...sp, ...mp];
      if (ctx.args.tipe) deals = deals.filter((d) => lower(d.tipe) === lower(ctx.args.tipe));
      return {
        deals, count: deals.length,
        expected_idr: sumBy(deals, 'expected_idr'),
        source_tabs: ['Target Partnership', 'MEDIA PARTNER'],
        summary: deals.map((d) => `${d.company} (${d.tipe}) - ${d.status}`),
      };
    },
  },

  speaker_candidates: {
    description: 'Kandidat speaker + status kontak.',
    shape: { event, status: z.string().optional(), pic: z.string().optional() },
    run: async (ctx) => {
      let candidates = (await readTab(ctx, '[LO] Speakers Candidate')).rows.map(speakerRow);
      if (ctx.args.status) candidates = candidates.filter((c) => lower(c.status) === lower(ctx.args.status));
      if (ctx.args.pic) candidates = candidates.filter((c) => contains(c.pic, ctx.args.pic));
      return {
        candidates, count: candidates.length,
        summary: candidates.map((c) => `${c.name} - ${c.status}`),
      };
    },
  },

  task_list: {
    description: 'Task + PIC + deadline + status enum.',
    shape: { event, pic: z.string().optional(), status: z.string().optional() },
    run: async (ctx) => {
      let tasks = (await readTab(ctx, 'General Task')).rows.map(taskRow);
      if (ctx.args.pic) tasks = tasks.filter((t) => contains(t.pic, ctx.args.pic));
      if (ctx.args.status) tasks = tasks.filter((t) => lower(t.status) === lower(ctx.args.status));
      return {
        tasks, count: tasks.length,
        summary: tasks.map((t) => `${t.title} | ${t.pic} | ${t.status} | ${t.due_date ?? 'TBD'}`),
      };
    },
  },

  organizer_list: {
    description: 'Panitia + volunteer (satu entitas, dedup).',
    shape: { event, division: z.string().optional(), tipe: z.string().optional() },
    run: async (ctx) => {
      const committee = (await readTab(ctx, 'Commitee')).rows.map((r) => organizerRow(r, 'Committee'));
      const volunteer = (await readTab(ctx, 'Final New Volunteer')).rows.map((r) => organizerRow(r, 'Volunteer'));
      let organizers = uniqueBy([...committee, ...volunteer], (o) => lower(o.email) || lower(o.name));
      if (ctx.args.division) organizers = organizers.filter((o) => contains(o.division, ctx.args.division));
      if (ctx.args.tipe) organizers = organizers.filter((o) => lower(o.tipe) === lower(ctx.args.tipe));
      return {
        organizers, count: organizers.length,
        with_phone: organizers.filter((o) => o.phone).length,
        source_tabs: ['Commitee', 'Final New Volunteer'],
        summary: organizers.map((o) => `${o.name} | ${o.tipe} | ${o.division ?? '-'}`),
      };
    },
  },

  logistic_needs: {
    description: 'Kebutuhan logistik + vendor + status bayar.',
    shape: { event, division: z.string().optional() },
    run: async (ctx) => {
      let needs = (await readTab(ctx, 'LOGISTIC')).rows.map(logisticRow);
      if (ctx.args.division) needs = needs.filter((n) => contains(n.vendor, ctx.args.division) || contains(n.item, ctx.args.division));
      return {
        needs, count: needs.length, total_idr: sumBy(needs, 'total_idr'),
        summary: needs.map((n) => `${n.item} x${n.qty ?? 0} - ${n.status_bayar}`),
      };
    },
  },

  agenda_zona: {
    description: 'Rundown per zona (main hall/workshop/auditorium).',
    shape: { event, zona: z.string().optional() },
    run: async (ctx) => {
      let blocks = (await readTab(ctx, 'Timeline Acara 2026 (Draft)')).rows.map(agendaRow);
      if (ctx.args.zona) blocks = blocks.filter((b) => contains(b.zona, ctx.args.zona));
      return {
        blocks, count: blocks.length,
        summary: blocks.map((b) => `${b.zona} ${b.start}-${b.end} ${b.format ?? ''}`.trim()),
      };
    },
  },

  risk_register: {
    description: 'Risiko + skor (probability x impact) + mitigasi.',
    shape: { event, min_score: z.number().optional() },
    run: async (ctx) => {
      let risks = (await readTab(ctx, 'Risk Register')).rows.map(riskRow);
      const min = ctx.args.min_score;
      if (min != null) risks = risks.filter((r) => (r.score ?? 0) >= min);
      return {
        risks, count: risks.length,
        summary: risks.map((r) => `${r.description} | skor ${r.score ?? '-'}`),
      };
    },
  },
};
