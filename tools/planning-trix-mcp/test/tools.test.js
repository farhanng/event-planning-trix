import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS, taskRow, ticketRow, budgetLine, budgetEntry, sponsorPackageRow, designTaskRow,
  objectiveRow, dealRow, speakerRow, organizerRow, logisticRow, loRow,
} from '../src/app/tools/index.js';
import { makeCtx, makeSheets, TABS } from './helpers.js';

const run = (name, args, overrides = {}) => TOOLS[name].run({ ...makeCtx(overrides), args });
const devArgs = (extra = {}) => ({ event: 'devfest26', ...extra });

test('row mappers happy path + edge', () => {
  assert.deepEqual(taskRow({ no: '1', title: 'T', priority: 'high', pic: '', status: 'Done', due_date: '01/11/2026' }), {
    id: '1', title: 'T', priority: 'High', pic: null, status: 'Selesai', raw_status: 'Done',
    due_date: '2026-11-01', note: null, data_valid: true, status_valid: true,
  });
  assert.equal(taskRow({ id: 'x', note: 'n' }).id, 'x');
  assert.equal(taskRow({ id: 'x' }).data_valid, false);
  assert.equal(taskRow({ status: 'TBC' }).status, 'Belum Mulai');

  assert.equal(ticketRow({ price_idr: '100', pax: '2' }).total_idr, 200);
  assert.equal(ticketRow({ total_idr: '500' }).total_idr, 500);
  assert.equal(ticketRow({}).total_idr, null);
  assert.equal(ticketRow({ packages: '5' }).packages, '5');

  assert.equal(budgetLine({ qty: '3', unit_price_idr: '10' }).total_idr, 30);
  assert.equal(budgetLine({ total_idr: '99' }).total_idr, 99);
  assert.equal(budgetLine({}).total_idr, null);
  assert.equal(budgetLine({ unit: 'lot' }).unit, 'lot');

  assert.deepEqual(budgetEntry({ type: 'IN', nominal_idr: '100', status_raw: 'Potensi' }), {
    type: 'In', source: null, nominal_idr: 100, status: 'unknown', raw_status: 'Potensi', note: null,
  });
  assert.equal(budgetEntry({ type: 'out', status_raw: 'Lunas' }).type, 'Out');
  assert.equal(budgetEntry({ type: 'out', status_raw: 'Lunas' }).status, 'Lunas');
  assert.equal(budgetEntry({}).type, null);

  assert.equal(sponsorPackageRow({ slot: '2', price_idr: '100' }).potential_total_idr, 200);
  assert.equal(sponsorPackageRow({ potential_total_idr: '500' }).potential_total_idr, 500);
  assert.equal(sponsorPackageRow({}).potential_total_idr, null);
  assert.equal(sponsorPackageRow({ slot: '-' }).slot, null);

  assert.equal(designTaskRow({ status: 'On Progress', deadline: '2026-10-01' }).status, 'Proses');
  assert.equal(designTaskRow({ status: 'On Progress' }).raw_status, 'On Progress');
  assert.equal(designTaskRow({ deadline: '2026-10-01' }).deadline, '2026-10-01');

  assert.equal(objectiveRow({ objective: 'O', key_result: 'KR', value: '0', percentage: '0,00%' }).value, 0);

  assert.equal(dealRow({ company: 'C', contact: 'wa' }, 'Sponsor').contact, 'wa');
  assert.equal(dealRow({}, 'Media Partner').tipe, 'Media Partner');
  assert.equal(dealRow({ status: 'Dealing' }, 'Sponsor').status, 'Dealing');
  assert.equal(dealRow({ phone: '6281234567890' }, 'Sponsor').phone, '+6281234567890');

  assert.equal(speakerRow({ name: 'N', status: 'Proses' }).status, 'Proses');
  assert.equal(speakerRow({ name: 'X', status: 'Belum dikontak' }).status, 'Belum Dikontak');
  assert.equal(speakerRow({ name: 'Y', status: 'Batal' }).status, 'Batal');

  assert.deepEqual(organizerRow({ name: 'A', contact: '08123456789' }, 'Committee'), {
    name: 'A', email: null, phone: '+628123456789', division: null, role: null, tipe: 'Committee',
  });
  assert.equal(organizerRow({ phone: '0812', role: 'R' }, 'Volunteer').role, 'R');
  assert.equal(organizerRow({ pre_day_role: 'PD' }, 'Committee').role, 'PD');

  assert.equal(logisticRow({ quantity: '2', status: 'PROCESS' }).quantity, 2);
  assert.equal(logisticRow({ quantity: '2', status: 'PROCESS' }).status_bayar, 'Proses');
  assert.equal(logisticRow({}).status_bayar, 'unknown');

  assert.equal(loRow({ contact: '+62813-8688-1171' }).contact, '+6281386881171');
  assert.equal(loRow({}).contact, null);
  assert.equal(speakerRow({ person_name: 'P' }).name, 'P');
  assert.equal(speakerRow({}).name, null);
});

test('summary fallbacks for null fields', async () => {
  const packages = await run('speaker_packages', devArgs(), {
    sheets: makeSheets({ 'Paket Sponsor 2026 (Draft)': [['b1'], ['b2'], ['b3'], ['P', 'Slot', 'Harga', 'Potensi', 'Catatan'], ['Bronze', '-', '', '', '']] }),
  });
  assert.match(packages.summary[0], /Bronze: Rp0 x -/);

  const speakers = await run('speaker_candidates', devArgs(), {
    sheets: makeSheets({ '[LO] Speakers Candidate': [['Name', 'Topic', 'Role/Title', 'Contact PIC', 'Notes', 'Status'], ['N', 'T', 'R', 'P', 'n', '']] }),
  });
  assert.match(speakers.summary[0], /N - unknown/);

  const designs = await run('design_tasks', devArgs(), {
    sheets: makeSheets({ 'Design Task': [['Design', 'Type', 'Designer', 'Status', 'Deadline', 'Note'], ['A', 'IG', '', 'Done', '', ''], ['B', 'IG', 'Ghinna', 'Done', '2026-10-01', '']] }),
  });
  assert.match(designs.summary[0], /A \| - \| Selesai \| TBD/);
  assert.match(designs.summary[1], /Ghinna/);

  const objs = await run('objectives', devArgs(), {
    sheets: makeSheets({ 'Objectives': [['Objectives', 'Key Results (KR)', 'Sie', 'Metrik', 'Target', 'Nilai', 'Percentage'], ['OBJ', '', '', '', '', '', '']] }),
  });
  assert.match(objs.summary[0], /OBJ \| - \| -/);

  const needs = await run('logistic_needs', devArgs(), {
    sheets: makeSheets({ 'LOGISTIC - NEEDS': [['b1'], ['b2'], ['b3'], ['b4'], ['', 'Divisi', 'Item', 'Quantity', 'Notes', 'Status'], ['', 'Acara', 'Mic', '', '', 'PROCESS']] }),
  });
  assert.match(needs.summary[0], /Mic x0 - Proses/);

  const loData = makeSheets({ 'Job on Stage 2026 (Clean)': [['b1'], ['b2'], ['b3'], ['b4'], ['No', 'Nama', 'Kontak', 'Asal', 'Peran LO', 'Status', 'Catatan'], ['1', 'Malendra', '', 'PDD-LO', '', 'Aktif', ''], ['2', 'TanpaStatus', '', 'PDD-LO', '', '', '']] });
  const los = await run('lo_roster', devArgs(), { sheets: loData });
  assert.equal(los.count, 2);
  assert.match(los.summary[0], /Malendra \| - \| Aktif/);
  assert.match(los.summary[1], /TanpaStatus \| - \| -/);
  const losFiltered = await run('lo_roster', devArgs({ status: 'Aktif' }), { sheets: loData });
  assert.equal(losFiltered.count, 1);
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
  assert.equal(arsip.count, 2);
  assert.equal(arsip.tabs[0].title, 'Agenda');
  assert.equal(all.tabs.find((t) => t.title === 'General Task').write_allowed, true);
  assert.equal(all.tabs.find((t) => t.title === 'Agenda').write_allowed, false);
  assert.equal(all.tabs.find((t) => t.title === 'Index & Standar').read_by, null);
});

test('budget_summary + conflict detection', async () => {
  const out = await run('budget_summary', devArgs());
  assert.equal(out.subtotal_idr, 45500000);
  assert.equal(out.total_out_idr, 28000000);
  assert.equal(out.income_idr, 53507477);
  assert.equal(out.gap_idr, 25507477);
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.lines.length, 2);
  assert.equal(out.entries.length, 2);
  assert.ok(out.summary.length);
  assert.ok(out.warnings.length);
  const clean = await run('budget_summary', devArgs(), {
    sheets: makeSheets({
      'Budget 2026 (Draft)': [['b1'], ['b2'], ['b3'], ['C', 'I', 'Q', 'U', 'E', 'F'], ['Venue', 'X', '1', 'lot', '100', '100']],
      'Budget 2026 - In Out': [['b1'], ['b2'], ['b3'], ['T', 'S', 'N'], ['Out', 'Y', '100']],
    }),
  });
  assert.deepEqual(clean.conflicts, []);
  assert.equal(clean.subtotal_idr, 100);
});

test('ticket_summary', async () => {
  const out = await run('ticket_summary', devArgs());
  assert.equal(out.total_ticket_idr, 25000000);
  assert.equal(out.total_pax, 300);
  assert.equal(out.avg_per_pax_idr, 83333);
  const zero = await run('ticket_summary', devArgs(), {
    sheets: makeSheets({ 'Tiket 2026 (Draft)': [['b1'], ['b2'], ['b3'], ['T'], ['Free tier']] }),
  });
  assert.equal(zero.avg_per_pax_idr, null);
});

test('partnership_pipeline filter', async () => {
  const out = await run('partnership_pipeline', devArgs());
  assert.equal(out.count, 2);
  assert.equal(out.deals[0].tipe, 'Sponsor');
  assert.equal(out.expected_usd, 5000);
  assert.equal((await run('partnership_pipeline', devArgs({ tipe: 'media partner' }))).count, 1);
  assert.equal((await run('partnership_pipeline', devArgs({ status: 'Dealing' }))).count, 1);
});

test('speaker_packages', async () => {
  const out = await run('speaker_packages', devArgs());
  assert.equal(out.count, 2);
  assert.equal(out.potential_total_idr, 20000000);
  assert.ok(out.summary.length);
});

test('speaker_candidates filters', async () => {
  assert.equal((await run('speaker_candidates', devArgs())).count, 2);
  assert.equal((await run('speaker_candidates', devArgs({ status: 'Batal' }))).count, 1);
  assert.equal((await run('speaker_candidates', devArgs({ pic: 'ilham' }))).count, 2);
});

test('task_list filters', async () => {
  const out = await run('task_list', devArgs());
  assert.equal(out.count, 2);
  assert.equal(out.valid, 2);
  assert.equal((await run('task_list', devArgs({ pic: 'far' }))).count, 1);
  assert.equal((await run('task_list', devArgs({ status: 'proses' }))).count, 1);
});

test('design_tasks filters', async () => {
  assert.equal((await run('design_tasks', devArgs())).count, 2);
  assert.equal((await run('design_tasks', devArgs({ designer: 'ghinna' }))).count, 2);
  assert.equal((await run('design_tasks', devArgs({ status: 'proses' }))).count, 1);
});

test('objectives filter', async () => {
  assert.equal((await run('objectives', devArgs())).count, 1);
  assert.equal((await run('objectives', devArgs({ sie: 'humas' }))).count, 1);
  assert.equal((await run('objectives', devArgs({ sie: 'xyz' }))).count, 0);
});

test('organizer_list dedup + filters', async () => {
  const out = await run('organizer_list', devArgs());
  assert.equal(out.count, 4);
  assert.equal(out.with_phone, 3);
  assert.equal((await run('organizer_list', devArgs({ division: 'program' }))).count, 2);
  assert.equal((await run('organizer_list', devArgs({ tipe: 'committee' }))).count, 2);
});

test('logistic_needs + lo_roster', async () => {
  assert.equal((await run('logistic_needs', devArgs())).count, 2);
  assert.equal((await run('logistic_needs', devArgs({ division: 'acara' }))).count, 1);
  assert.equal((await run('logistic_needs', devArgs({ status: 'proses' }))).count, 1);
  assert.equal((await run('lo_roster', devArgs())).count, 1);
  assert.equal((await run('lo_roster', devArgs({ role: 'liaison' }))).count, 1);
  assert.equal((await run('lo_roster', devArgs({ role: 'nope' }))).count, 0);
});

test('unknown event propagates PtxError', async () => {
  await assert.rejects(() => run('task_list', { event: 'nope' }), (e) => e.code === 'E_EVENT_UNKNOWN');
});