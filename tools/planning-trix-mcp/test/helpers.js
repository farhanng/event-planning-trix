import { loadRegistry } from '../src/infra/registry/registry.js';

// Registry contoh untuk tes: bentuknya sama seperti registry/planning.json kurasi.
export const TABS = {
  'Commitee': { kind: 'Aktif', entity: 'organizer', headerRow: 1, columns: { name: 'A', pre_day_role: 'B', day_role: 'C', shirt_size: 'D', contact: 'E' } },
  'Design Task': { kind: 'Aktif', entity: 'design_task', headerRow: 1, columns: { design: 'A', type: 'B', designer: 'C', status: 'D', deadline: 'E', note: 'F' } },
  'Budget 2026 (Draft)': { kind: 'Draft', entity: 'budget_line', headerRow: 4, columns: { category: 'A', item: 'B', qty: 'C', unit: 'D', unit_price_idr: 'E', total_idr: 'F', note: 'G' } },
  'Budget 2026 - In Out': { kind: 'Draft', entity: 'budget_entry', headerRow: 4, columns: { type: 'A', source: 'B', nominal_idr: 'C', status_raw: 'D', note: 'E' } },
  'Tiket 2026 (Draft)': { kind: 'Draft', entity: 'ticket_tier', headerRow: 4, columns: { tier: 'A', includes: 'B', price_idr: 'C', packages: 'D', pax: 'E', total_idr: 'F', note: 'G' } },
  'Paket Sponsor 2026 (Draft)': { kind: 'Draft', entity: 'sponsor_package', headerRow: 4, columns: { package: 'A', slot: 'B', price_idr: 'C', potential_total_idr: 'D', note: 'E' } },
  'General Task': { kind: 'Aktif', entity: 'task', headerRow: 1, columns: { no: 'A', title: 'B', priority: 'C', pic: 'D', note: 'E', status: 'F', due_date: 'G' } },
  'Objectives': { kind: 'Aktif', entity: 'objective', headerRow: 1, columns: { objective: 'A', key_result: 'B', sie: 'C', metric: 'D', target: 'E', value: 'F', percentage: 'G' } },
  '[LO] Speakers Candidate': { kind: 'Aktif', entity: 'speaker_pipeline', headerRow: 1, columns: { name: 'A', topic: 'B', role_title: 'C', contact_pic: 'D', notes: 'E', status: 'F' } },
  'Target Partnership': { kind: 'Aktif', entity: 'partnership_deal', headerRow: 1, columns: { no: 'A', company: 'B', pic: 'C', expected_usd: 'D', status: 'E', note_update: 'F', contact_person: 'G', title: 'H', link_contact: 'I', address: 'J', phone: 'K', email: 'L' } },
  'MEDIA PARTNER': { kind: 'Aktif', entity: 'partnership_deal', headerRow: 1, columns: { company: 'A', category: 'B', social_url: 'C', email: 'D', phone: 'E', address: 'F', terms: 'G' } },
  'LOGISTIC - NEEDS': { kind: 'Aktif', entity: 'logistic_need', headerRow: 5, columns: { division: 'B', item: 'C', quantity: 'D', notes: 'E', status: 'F' } },
  'Final New Volunteer': { kind: 'Aktif', entity: 'organizer', headerRow: 1, columns: { no: 'A', name: 'B', division: 'C', role: 'D', email: 'E', phone: 'F', occupation: 'G' } },
  'Potential Volunteer': { kind: 'Aktif', entity: 'potential_volunteer', headerRow: 1, columns: { no: 'A', name: 'B', division: 'C', role: 'D', email: 'E', phone: 'F', occupation: 'G', source: 'H', status: 'I', note: 'J', promoted_at: 'K' } },
  'Job on Stage 2026 (Clean)': { kind: 'Aktif', entity: 'lo_roster', headerRow: 5, columns: { no: 'A', name: 'B', contact: 'C', origin: 'D', role: 'E', status: 'F', note: 'G' } },
  'Timeline Acara 2026 (Draft)': { kind: 'Draft', entity: 'agenda_block', headerRow: 6, columns: { start: 'A', end: 'B', duration: 'C', session: 'D', format: 'E', pic: 'F', note: 'G' } },
  'Index & Standar': { kind: 'Referensi', headerRow: 4, note: 'index + standar format' },
  'Agenda': { kind: 'Arsip', vintage: '2025', note: 'rundown 2025' },
  'Task Management': { kind: 'Arsip', vintage: '2025', note: 'WBS 2025' },
};

export const DATA = {
  'Commitee': [
    ['GDG Cloud Bandung Committee', 'Pre Day Role (PD)', 'The Day Role (D)', 'Size', 'Contact'],
    ['Farhan Naufal', 'Not Assigned', 'Coordinator', 'L', '08123456789'],
    ['Ilham Gibran', 'Not Assigned', 'Logistic', 'M', ''],
  ],
  'Design Task': [
    ['Design', 'Type', 'Designer', 'Status', 'Deadline', 'Note'],
    ['Coming Soon', 'Instagram Post', 'Ghinna', 'Done', '2026-10-01', ''],
    ['Call Sponsorship', 'Instagram Post', 'Ghinna', 'On Progress', '', 'nudge'],
  ],
  'Budget 2026 (Draft)': [
    ['DRAFT ANGGARAN DEVFEST 2026'],
    ['Venue dBotanica (FIX)'],
    [],
    ['Kategori', 'Item', 'Qty', 'Satuan', 'Harga Satuan (IDR)', 'Total (IDR)', 'Catatan'],
    ['A. Venue & F&B', 'Venue dBotanica', '1', 'lot', 'Rp28.000.000', 'Rp28.000.000', 'FIX'],
    ['', 'Makan peserta', '500', 'pax', 'Rp35.000', '', ''],
  ],
  'Budget 2026 - In Out': [
    ['BUDGET IN-OUT — DEVFEST 2026'],
    ['Rekap arus dana'],
    [],
    ['Tipe', 'Sumber / Kategori', 'Nominal (IDR)', 'Status', 'Catatan'],
    ['IN', 'Pendanaan Google', '53507477', 'Potensi', ''],
    ['OUT', 'Belanja venue', '28000000', 'Lunas', ''],
  ],
  'Tiket 2026 (Draft)': [
    ['DRAFT TIKET & BUDGET BREAKDOWN'],
    ['Model berbayar'],
    [],
    ['Tier', 'Isi', 'Harga (IDR)', 'Qty paket', 'Pax', 'Total (IDR)', 'Catatan'],
    ['Reguler', 'Conference pass', '50000', '200', '200', '10000000', ''],
    ['Premium', 'All-access', '150000', '100', '100', '', ''],
  ],
  'Paket Sponsor 2026 (Draft)': [
    ['PAKET SPONSOR DEVFEST 2026'],
    ['Basis deck lama'],
    [],
    ['PAKET LAMA (basis 2025)', 'Slot', 'Harga (IDR)', 'Potensi total (IDR)', 'Catatan'],
    ['Platinum', '2', '10000000', '', 'Slot speaking'],
    ['Gold', '-', '7500000', '-', 'Booth'],
  ],
  'General Task': [
    ['No', 'Todo', 'Priority', 'PIC', 'Keterangan', 'Status', 'Deadline'],
    ['1', 'Pengajuan venue', 'High', 'Farhan Naufal', 'lanjut', 'In-Progress', '2026-11-01'],
    ['2', 'Tetapkan PIC', 'High', '', 'ketuplak', 'Done', ''],
  ],
  'Objectives': [
    ['Objectives', 'Key Results (KR)', 'Sie Penanggung Jawab', 'Metrik dan Target', 'Target', 'Nilai', 'Percentage'],
    ['OBJECTIVE 1', 'KR 1.1 (Registrasi)', 'Humas & Marketing', 'Check-in', '85%', '0', '0,00%'],
  ],
  '[LO] Speakers Candidate': [
    ['Name', 'Topic', 'Role/Title', 'Contact PIC', 'Notes', 'Status'],
    ['Cleo Credo', 'TBD', 'GDE', 'Ilham', 'Tidak jadi', 'Batal'],
    ['Jason Stanley', 'TBD', 'Engineer', 'Ilham', 'verifikasi', 'Belum dikontak'],
  ],
  'Target Partnership': [
    ['No.', 'Company name', 'PIC', 'Expected ($)', 'Status', 'Note update', 'Name person contact', 'Title', 'Link contact', 'Address', 'Phone', 'Email'],
    ['1', 'Sagala Group', 'Ary', '5000', 'Dealing', '', 'Ary', 'CTO', 'li', 'addr', '081214271416', 'a@x.com'],
  ],
  'MEDIA PARTNER': [
    ['Nama Media', 'Kategori', 'Social media', 'Email', 'Telepon', 'Alamat', 'S&K'],
    ['eventapaaja', 'Social media', 'ig', 'a@b.com', '628387872', 'addr', ''],
  ],
  'LOGISTIC - NEEDS': [
    [''],
    ['LOGISTIC NEEDS'],
    [],
    [],
    ['', 'Divisi', 'Item', 'Quantity', 'Notes', 'Status', 'Design', 'Url'],
    ['', 'Acara', 'Mic', '5 pcs', 'mainstage', 'PROCESS', 'T-Shirt', ''],
    ['', 'Konsumsi', 'Air mineral', '10', 'panitia', 'Done', '', ''],
  ],
  'Final New Volunteer': [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan'],
    ['1', 'Febby Deca Lestari', 'Program & Conference', 'Acara', 'lestari@x.com', '62085882270803', 'Mahasiswa'],
    ['2', 'Ayumi Putri', 'Program & Conference', 'Acara', 'ayumi@x.com', '62081386881171', 'Mahasiswa'],
  ],
  'Potential Volunteer': [
    ['no', 'nama', 'division', 'role', 'email', 'no_hp', 'pekerjaan', 'sumber', 'status', 'catatan', 'promoted_at'],
    ['3', 'Putri Handayani', 'Program & Conference', 'Acara', 'putri@x.com', '620812345678', 'Mahasiswa', 'open recruitment', 'Baru', '', ''],
    ['', 'Bagas Prakoso', 'Acara', '', '', '', '', '', 'Baru', '', ''],
    ['1', 'Citra Dewi', 'Acara', '', '', '', '', '', 'Baru', '', ''],
  ],
  'Job on Stage 2026 (Clean)': [
    ['PIC LO DevFest 2026'],
    ['Data 2025 sudah dipindah'],
    [],
    ['ROSTER LO 2026'],
    ['No', 'Nama', 'Kontak', 'Asal', 'Peran LO', 'Status', 'Catatan'],
    ['1', 'Malendra Rizky', '+62813-8688-1171', 'Commitee PDD-LO', 'Speaker Liaison', 'Aktif', ''],
  ],
  'Timeline Acara 2026 (Draft)': [
    ['[Timeline Acara 2026 (Draft)]'],
    ['Draft usulan'],
    ['PENTING: semua nama speaker'],
    [],
    ['A. GLOBAL - semua zona'],
    ['Starts', 'Ends', 'Durasi', 'Sesi', 'Format', 'PIC', 'Catatan'],
    ['9:00 AM', '9:20 AM', '0:20', 'Opening', 'Opening', 'MC', 'Video'],
  ],
  'Agenda': [['w', 'Main Hall']],
  'Task Management': [['WBS NUMBER', 'TASK TITLE']],
  'Index & Standar': [['000 - Standar & Index'], ['Rev 27 Sep 2026'], [], ['Tab', 'Status', 'Isi']],
};

export function makeSheets(data = DATA) {
  const store = { ...data };
  return {
    async getValues(title) {
      return store[title] ?? [];
    },
    async batchGet(titles) {
      const out = {};
      for (const t of titles) out[t] = store[t] ?? [];
      return out;
    },
    async appendValues(title, values) {
      store[title] = [...(store[title] ?? []), ...values];
      return { updatedRows: values.length, updatedRange: `${title}!A${store[title].length}` };
    },
    async updateValues(range, values) {
      const m = /^'?(.+?)'?!([A-Z]+)(\d+):[A-Z]+(\d+)$/.exec(range);
      if (m) {
        const [, title, col, start, end] = m;
        const row = Number(start) - 1;
        const grid = store[title] ?? [];
        const ci = col.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
        grid[row] = grid[row] ?? [];
        for (let i = 0; i < values[0].length; i++) grid[row][ci + i] = values[0][i];
        store[title] = grid;
        return { updatedCells: values[0].length, updatedRange: `${title}!${col}${start}:${end}` };
      }
      return { updatedCells: 0, updatedRange: range };
    },
    store,
  };
}

export function makeRegistry(overrides = {}) {
  return loadRegistry({
    version: 2,
    portfolio: { id: 'gdgc-bdg', name: 'GDG Cloud Bandung' },
    events: overrides.events ?? [
      { slug: 'devfest26', name: 'DevFest Cloud Bandung 2026', jenis: 'DevFest', year: 2026, folderId: 'F26', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_DEV', active: true },
      { slug: 'devfest25', name: 'DevFest Cloud Bandung 2025', jenis: 'DevFest', year: 2025, folderId: 'F25', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_PROD', active: false, catalogOnly: true },
      { slug: 'master', name: 'Master Data', jenis: null, year: null, folderId: 'FM', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_MASTER', active: true, readOnly: true, catalogOnly: true },
    ],
    tabsByEvent: overrides.tabsByEvent ?? { devfest26: TABS },
    tabs: overrides.tabs,
    enums: overrides.enums,
  }, 'test-registry');
}

export function makeCtx(overrides = {}) {
  return {
    registry: overrides.registry ?? makeRegistry(),
    sheets: overrides.sheets ?? makeSheets(),
    meta: overrides.meta ?? { env: 'dev' },
  };
}