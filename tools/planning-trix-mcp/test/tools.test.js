import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS, taskRow, ticketRow, budgetLine, budgetEntry, sponsorPackageRow, designTaskRow,
  objectiveRow, dealRow, speakerRow, organizerRow, logisticRow, loRow, potentialVolunteerRow,
} from '../src/app/tools/index.js';
import { makeCtx, makeSheets, makeRegistry, TABS } from './helpers.js';

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

test('budget_summary skips summary blocks and buffer', async () => {
  const sheets = makeSheets({
    'Budget 2026 (Draft)': [
      ['b1'], ['b2'], [], ['Kategori', 'Item', 'Qty', 'Satuan', 'Harga', 'Total', 'Catatan'],
      ['A. Venue', 'Venue', '1', 'lot', '1000', '1000', ''],
      [null, 'Extra', '2', 'pax', '500', '1000', ''],
      ['', 'Subtotal A', '', '', '', '2000', ''],
      ['TOTAL BELANJA', '', '', '', '', '2000', ''],
      ['PEMASUKAN (skenario)', 'Tiket', '1', 'lot', '5000', '5000', ''],
      ['', 'TOTAL PEMASUKAN', '', '', '', '5000', ''],
      ['CATATAN & ASUMSI'],
      ['1. anotasi bebas'],
    ],
    'Budget 2026 - In Out': [
      ['b1'], ['b2'], [], ['Tipe', 'Sumber', 'Nominal', 'Status', 'Catatan'],
      ['IN', 'Google', '53507477', '', ''],
      ['IN', 'TOTAL IN', '86757477', '', ''],
      ['OUT', 'Venue', '1000', '', ''],
      ['OUT', 'Subtotal belanja', '2000', '', ''],
      ['OUT', 'Buffer operasional', '5000', 'Cadangan', ''],
      ['OUT', 'TOTAL OUT + buffer', '7000', '', ''],
      ['OUT', 'TanpaNominal', '', '', ''],
      ['OUT', '', '1000', '', ''],
      ['POSISI', 'Gap', '5000', 'Target', ''],
      ['Tiket', '', '', '', ''],
    ],
  });
  const out = await run('budget_summary', devArgs(), { sheets });
  assert.equal(out.lines.length, 2);
  assert.equal(out.subtotal_idr, 2000);
  assert.equal(out.entries.length, 3);
  assert.equal(out.income_idr, 53507477);
  assert.equal(out.buffer_idr, 5000);
  assert.equal(out.total_out_idr, 7000);
  assert.equal(out.gap_idr, 53507477 - 7000);
  assert.deepEqual(out.conflicts, []);
});

test('takeDetails stops at summary marker for tiket and paket', async () => {
  const sheets = makeSheets({
    'Tiket 2026 (Draft)': [
      ['b1'], ['b2'], [], ['Tier', 'Isi', 'Harga', 'Qty paket', 'Pax', 'Total', 'Catatan'],
      ['Reguler', 'pass', '50000', '200', '200', '10000000', ''],
      [null, 'baris lanjutan', '', '', '', '', ''],
      ['TOTAL TIKET', '', '', '', '500', '33250000', ''],
    ],
    'Paket Sponsor 2026 (Draft)': [
      ['b1'], ['b2'], [], ['Paket', 'Slot', 'Harga', 'Potensi', 'Catatan'],
      ['Platinum', '2', '10000000', '20000000', ''],
      ['USULAN 2026 (naik)', 'Slot', 'Harga lama', 'Harga baru', 'Kenaikan'],
      ['Gold', '3', '9000000', '27000000', ''],
    ],
  });
  const t = await run('ticket_summary', devArgs(), { sheets });
  assert.equal(t.tiers.length, 2);
  assert.equal(t.total_pax, 200);
  const p = await run('speaker_packages', devArgs(), { sheets });
  assert.equal(p.count, 1);
  assert.equal(p.potential_total_idr, 20000000);
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

test('potentialVolunteerRow defaults + unknown enum', () => {
  const r = potentialVolunteerRow({ name: 'A', phone: '08123456789', status: 'baru' });
  assert.equal(r.name, 'A');
  assert.equal(r.phone, '+628123456789');
  assert.equal(r.status, 'Baru');
  assert.equal(r.raw_status, 'baru');
  const d = potentialVolunteerRow({ name: 'B' });
  assert.equal(d.status, 'Baru');
  assert.equal(d.raw_status, null);
  assert.equal(potentialVolunteerRow({ status: 'zzz' }).status, 'unknown');
  assert.equal(potentialVolunteerRow({ promoted_at: '01/10/2026' }).promoted_at, '2026-10-01');
  assert.equal(potentialVolunteerRow({ promoted_at: 'kemarin' }).promoted_at, 'kemarin');
});

test('list_potential_volunteers filters', async () => {
  const all = await run('list_potential_volunteers', devArgs());
  assert.equal(all.count, 3);
  assert.equal(all.not_promoted, 3);
  assert.equal(all.items[0].row, 2);
  assert.equal((await run('list_potential_volunteers', devArgs({ division: 'program' }))).count, 1);
  assert.equal((await run('list_potential_volunteers', devArgs({ status: 'baru' }))).count, 3);
});

test('add_potential_volunteer appends with next number + validation', async () => {
  const sheets = makeSheets();
  const out = await run('add_potential_volunteer', devArgs({ name: 'Dina', division: 'Acara', role: 'Runner', email: 'dina@x.com', phone: '081200001111' }), { sheets });
  assert.equal(out.added.name, 'Dina');
  assert.equal(out.added.phone, '+6281200001111');
  assert.equal(out.added.status, 'Baru');
  const appended = sheets.store['Potential Volunteer'].at(-1);
  assert.equal(appended[0], 4);
  assert.equal(appended[8], 'Baru');

  const minimal = await run('add_potential_volunteer', devArgs({ name: 'Eka', division: 'Acara' }), { sheets: makeSheets() });
  assert.equal(minimal.added.email, null);
  assert.equal(minimal.added.phone, null);

  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A', email: 'bad' })),
    (e) => e.code === 'E_VALIDATION' && e.details.field === 'email',
  );
  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A', email: 'PUTRI@x.com' })),
    (e) => e.code === 'E_VALIDATION' && e.details.field === 'email',
  );
  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A', phone: '620812345678' })),
    (e) => e.code === 'E_VALIDATION' && e.details.field === 'phone',
  );
});

test('add_potential_volunteer enforces dev write guard', async () => {
  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A' }), { meta: { env: 'prod' } }),
    (e) => e.code === 'E_WRITE_FORBIDDEN' && e.details.env === 'prod' && e.details.read_only === false,
  );
  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A' }), { meta: { env: 'dev', readOnly: true } }),
    (e) => e.code === 'E_WRITE_FORBIDDEN' && e.details.read_only === true,
  );
  const noMeta = makeCtx();
  delete noMeta.meta;
  await assert.rejects(
    () => TOOLS.add_potential_volunteer.run({ ...noMeta, args: devArgs({ name: 'X', division: 'A' }) }),
    (e) => e.code === 'E_WRITE_FORBIDDEN' && e.details.env === null,
  );
  const registry = makeRegistry({
    tabsByEvent: { devfest26: { ...TABS, 'Potential Volunteer': { ...TABS['Potential Volunteer'], kind: 'Arsip' } } },
  });
  await assert.rejects(
    () => run('add_potential_volunteer', devArgs({ name: 'X', division: 'A' }), { registry }),
    (e) => e.code === 'E_WRITE_FORBIDDEN' && e.details.kind === 'Arsip',
  );
  const noKind = makeRegistry({
    tabsByEvent: { devfest26: { ...TABS, 'Potential Volunteer': { entity: 'potential_volunteer', headerRow: 1, columns: TABS['Potential Volunteer'].columns } } },
  });
  assert.equal((await run('add_potential_volunteer', devArgs({ name: 'Z', division: 'A' }), { registry: noKind })).added.name, 'Z');
});

test('rowToValues skips invalid column letters', async () => {
  const registry = makeRegistry({
    tabsByEvent: { devfest26: { ...TABS, 'Potential Volunteer': { ...TABS['Potential Volunteer'], columns: { ...TABS['Potential Volunteer'].columns, bad: 'A1', num: 5 } } } },
  });
  const sheets = makeSheets();
  await run('add_potential_volunteer', devArgs({ name: 'Bad Kolom', division: 'Acara' }), { registry, sheets });
  const appended = sheets.store['Potential Volunteer'].at(-1);
  assert.equal(appended[1], 'Bad Kolom');
});

test('potential volunteer helpers tolerate missing columns + headerRow', async () => {
  const registry = makeRegistry({
    tabsByEvent: { devfest26: { ...TABS, 'Potential Volunteer': { kind: 'Aktif', entity: 'potential_volunteer' } } },
  });
  const sheets = makeSheets();
  const empty = await run('list_potential_volunteers', devArgs(), { registry, sheets });
  assert.equal(empty.count, 0);
  const added = await run('add_potential_volunteer', devArgs({ name: 'Tanpa Kolom', division: 'Acara' }), { registry, sheets });
  assert.equal(added.added.name, 'Tanpa Kolom');
});

test('list_potential_volunteers tolerates non-array values + missing headerRow', async () => {
  const cols = TABS['Potential Volunteer'].columns;
  const registry = makeRegistry({
    tabsByEvent: { devfest26: { ...TABS, 'Potential Volunteer': { kind: 'Aktif', entity: 'potential_volunteer', columns: cols } } },
  });
  const sheets = makeSheets();
  sheets.getValues = async () => null;
  const out = await run('list_potential_volunteers', devArgs(), { registry, sheets });
  assert.equal(out.count, 0);
});

test('list_potential_volunteers fallback for blank row + raw_status', async () => {
  const sheets = makeSheets();
  sheets.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['1', '', '', '', '', '', '', '', 'Baru', '', ''],
  ];
  const all = await run('list_potential_volunteers', devArgs(), { sheets });
  assert.equal(all.count, 1);
  assert.match(all.summary[0], /^- \| - \| Baru$/);
  const filtered = await run('list_potential_volunteers', devArgs({ status: 'zzz' }), { sheets });
  assert.equal(filtered.count, 0);
  const rawNull = await run('list_potential_volunteers', devArgs({ status: 'unknown' }), { sheets });
  assert.equal(rawNull.count, 0);
  const byRaw = makeSheets();
  byRaw.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['1', 'Raw Cocok', 'Acara', '', '', '', '', '', 'Pending', '', ''],
  ];
  const hit = await run('list_potential_volunteers', devArgs({ status: 'Pending' }), { sheets: byRaw });
  assert.equal(hit.count, 1);
  const byNullRaw = makeSheets();
  byNullRaw.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['1', 'Raw Null', 'Acara', '', '', '', '', '', '', '', ''],
  ];
  const miss = await run('list_potential_volunteers', devArgs({ status: 'zzz' }), { sheets: byNullRaw });
  assert.equal(miss.count, 0);
});

test('promote_volunteer moves to Final New Volunteer + stamps pool', async () => {
  const sheets = makeSheets();
  const out = await run('promote_volunteer', devArgs({ name: 'Putri Handayani' }), { sheets });
  assert.equal(out.promoted.status, 'Dipromosikan');
  assert.equal(out.promoted.name, 'Putri Handayani');
  assert.match(out.promoted.promoted_at, /^\d{4}-\d{2}-\d{2}$/);
  const finalRow = sheets.store['Final New Volunteer'].at(-1);
  assert.equal(finalRow[0], 3);
  assert.equal(finalRow[1], 'Putri Handayani');
  const stamped = sheets.store['Potential Volunteer'][1];
  assert.equal(stamped[8], 'Dipromosikan');
  assert.match(stamped[10], /^\d{4}-\d{2}-\d{2}$/);

  const custom = await run('promote_volunteer', devArgs({ name: 'Bagas Prakoso', target_status: 'Ditolak' }), { sheets: makeSheets() });
  assert.equal(custom.promoted.status, 'Ditolak');
});

test('promote_volunteer error paths', async () => {
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Putri Handayani', target_status: 'zzz' })),
    (e) => e.code === 'E_VALIDATION' && Array.isArray(e.details.allowed),
  );
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Tidak Ada' })),
    (e) => e.code === 'E_TAB_NOT_FOUND',
  );
  const promoted = makeSheets();
  promoted.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['1', 'Sudah Jadi', 'Acara', '', '', '', '', '', 'Dipromosikan', '', '2026-09-29'],
  ];
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Sudah Jadi' }), { sheets: promoted }),
    (e) => e.code === 'E_VALIDATION' && /sudah dipromosikan/.test(e.message),
  );
  const dupFinal = makeSheets();
  dupFinal.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['1', 'Febby Kembar', 'Program', '', 'lestari@x.com', '', '', '', 'Baru', '', ''],
  ];
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Febby Kembar' }), { sheets: dupFinal }),
    (e) => e.code === 'E_VALIDATION' && /Sudah ada di Final/.test(e.message),
  );
  const dupPhone = makeSheets();
  dupPhone.store['Potential Volunteer'] = [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['1', 'Tanpa Email', 'Program', '', '', '62085882270803', '', '', 'Baru', '', ''],
  ];
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Tanpa Email' }), { sheets: dupPhone }),
    (e) => e.code === 'E_VALIDATION' && /Sudah ada di Final/.test(e.message),
  );
  await assert.rejects(
    () => run('promote_volunteer', devArgs({ name: 'Putri Handayani' }), { sheets: makeSheets(), meta: { env: 'prod', readOnly: true } }),
    (e) => e.code === 'E_WRITE_FORBIDDEN',
  );
});