import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS, taskRow, ticketRow, budgetLine, dealRow, speakerRow, organizerRow, logisticRow, agendaRow, riskRow,
} from '../src/app/tools/index.js';
import { makeCtx, makeSheets, makeRegistry, TABS } from './helpers.js';

const run = (name, args, overrides = {}) => TOOLS[name].run({ ...makeCtx(overrides), args });
const devArgs = (extra = {}) => ({ event: 'devfest26', ...extra });

test('row mappers happy path', () => {
  assert.deepEqual(taskRow({ no: '1', title: 'T', priority: 'high', pic: '', status: 'Done', due_date: '01/11/2026' }), {
    id: '1', title: 'T', priority: 'High', pic: 'TBD', status: 'Selesai', raw_status: 'Done', due_date: '2026-11-01', note: null,
  });
  assert.deepEqual(taskRow({ id: 'x', note: 'n' }).id, 'x');
  assert.equal(ticketRow({ price_idr: '100', pax: '2' }).total_idr, 200);
  assert.equal(ticketRow({ total_idr: '500' }).total_idr, 500);
  assert.equal(ticketRow({}).total_idr, null);
  assert.equal(budgetLine({ qty: '3', unit_price_idr: '10' }).total_idr, 30);
  assert.equal(budgetLine({ total_idr: '99' }).total_idr, 99);
  assert.equal(budgetLine({}).total_idr, null);
  assert.deepEqual(dealRow({ company: 'C', contact: 'wa' }, 'Sponsor').contact, 'wa');
  assert.equal(dealRow({}, 'Media Partner').tipe, 'Media Partner');
  assert.equal(speakerRow({ name: 'N', status: 'Proses' }).status, 'Proses');
  assert.deepEqual(organizerRow({ name: 'A', contact: '08123456789' }, 'Committee'), { name: 'A', email: null, phone: '+628123456789', tipe: 'Committee', division: null, role: null });
  assert.equal(organizerRow({ phone: '0812', role: 'R' }, 'Volunteer').role, 'R');
  assert.equal(logisticRow({ qty: '2', unit_price_idr: '5' }).total_idr, 10);
  assert.equal(logisticRow({ total_idr: '7' }).total_idr, 7);
  assert.equal(logisticRow({}).total_idr, null);
  assert.equal(agendaRow({ zona: 'main hall' }).zona, 'Main Hall');
  assert.deepEqual(riskRow({ id: 'R', probability: '3', impact: '4' }).score, 12);
  assert.equal(riskRow({}).score, null);
});

test('event_catalog filters', async () => {
  const all = await run('event_catalog', {});
  assert.equal(all.count, 3);
  assert.equal((await run('event_catalog', { year: 2025 })).count, 1);
  assert.equal((await run('event_catalog', { jenis: 'devfest' })).count, 2);
  assert.equal(TOOLS.event_catalog.shape.year.safeParse(2026).success, true);
});

test('planning_index', async () => {
  const all = await run('planning_index', devArgs());
  assert.equal(all.count, Object.keys(TABS).length);
  const arsip = await run('planning_index', devArgs({ kind: 'arsip' }));
  assert.equal(arsip.count, 1);
  assert.equal(arsip.tabs[0].title, 'Agenda');
});

test('budget_summary + conflict detection', async () => {
  const out = await run('budget_summary', devArgs());
  assert.equal(out.subtotal_idr, 87500000);
  assert.equal(out.total_out_idr, 88000000);
  assert.equal(out.gap_idr, 12000000);
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.lines.length, 2);
  assert.ok(out.summary.length);
  const clean = await run('budget_summary', devArgs(), {
    sheets: makeSheets({
      'Budget 2026 (Draft)': [['C', 'I', 'Q', 'U', 'E', 'F'], ['Venue', 'X', '1', 'lot', '100', '100']],
      'Budget 2026 - In Out': [['T', 'S', 'N'], ['Out', 'Y', '100']],
    }),
  });
  assert.deepEqual(clean.conflicts, []);
  assert.equal(clean.subtotal_idr, 100);
});

test('ticket_summary', async () => {
  const out = await run('ticket_summary', devArgs());
  assert.equal(out.total_ticket_idr, 52500000);
  assert.equal(out.total_pax, 400);
  assert.equal(out.avg_per_pax_idr, 131250);
  const zero = await run('ticket_summary', devArgs(), {
    sheets: makeSheets({ 'Tiket 2026 (Draft)': [['T'], ['Free tier']] }),
  });
  assert.equal(zero.avg_per_pax_idr, null);
});

test('partnership_pipeline filter', async () => {
  const out = await run('partnership_pipeline', devArgs());
  assert.equal(out.count, 2);
  assert.equal(out.deals[0].tipe, 'Sponsor');
  assert.equal((await run('partnership_pipeline', devArgs({ tipe: 'media partner' }))).count, 1);
});

test('speaker_candidates filters', async () => {
  assert.equal((await run('speaker_candidates', devArgs())).count, 2);
  assert.equal((await run('speaker_candidates', devArgs({ status: 'Batal' }))).count, 1);
  assert.equal((await run('speaker_candidates', devArgs({ pic: 'cendikia' }))).count, 2);
});

test('task_list filters', async () => {
  assert.equal((await run('task_list', devArgs())).count, 2);
  assert.equal((await run('task_list', devArgs({ pic: 'far' }))).count, 1);
  assert.equal((await run('task_list', devArgs({ status: 'belum mulai' }))).count, 1);
});

test('organizer_list dedup + filters', async () => {
  const out = await run('organizer_list', devArgs());
  assert.equal(out.count, 3);
  assert.equal(out.with_phone, 3);
  assert.equal((await run('organizer_list', devArgs({ division: 'design' }))).count, 1);
  assert.equal((await run('organizer_list', devArgs({ tipe: 'committee' }))).count, 1);
});

test('logistic_needs + agenda_zona + risk_register', async () => {
  assert.equal((await run('logistic_needs', devArgs())).count, 1);
  assert.equal((await run('logistic_needs', devArgs({ division: 'sound' }))).count, 1);
  assert.equal((await run('agenda_zona', devArgs())).count, 1);
  assert.equal((await run('agenda_zona', devArgs({ zona: 'main hall' }))).count, 1);
  assert.equal((await run('risk_register', devArgs())).count, 1);
  assert.equal((await run('risk_register', devArgs({ min_score: 20 }))).count, 0);
  assert.equal(TOOLS.risk_register.shape.min_score.safeParse(5).success, true);
});

test('unknown event propagates PtxError', async () => {
  await assert.rejects(() => run('task_list', { event: 'nope' }), (e) => e.code === 'E_EVENT_UNKNOWN');
});
