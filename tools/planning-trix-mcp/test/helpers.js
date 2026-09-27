import { loadRegistry } from '../src/infra/registry/registry.js';

export const TABS = {
  'Budget 2026 (Draft)': { kind: 'Aktif', entity: 'budget_line', headerRow: 1, columns: { category: 'A', item: 'B', qty: 'C', unit_price_idr: 'E', total_idr: 'F', note: 'G' } },
  'Budget 2026 - In Out': { kind: 'Turunan', derivedFrom: 'Budget 2026 (Draft)', entity: 'budget_summary', headerRow: 1, columns: { type: 'A', source: 'B', nominal_idr: 'C', status: 'D' } },
  'Tiket 2026 (Draft)': { kind: 'Aktif', entity: 'ticket_tier', headerRow: 1, columns: { tier: 'A', includes: 'B', price_idr: 'C', pax: 'E', total_idr: 'F', note: 'G' } },
  'Target Partnership': { kind: 'Aktif', entity: 'partnership_deal', headerRow: 1, columns: { company: 'B', pic: 'C', expected_idr: 'D', status: 'E', contact_person: 'G' } },
  'MEDIA PARTNER': { kind: 'Aktif', entity: 'partnership_deal', headerRow: 1, columns: { company: 'A', category: 'B', email: 'D', phone: 'E' } },
  '[LO] Speakers Candidate': { kind: 'Aktif', entity: 'speaker_pipeline', headerRow: 1, columns: { person_name: 'A', topic: 'B', role_title: 'C', contact_pic: 'D', note: 'E', status: 'F' } },
  'General Task': { kind: 'Aktif', entity: 'task', headerRow: 1, columns: { no: 'A', title: 'B', priority: 'C', pic: 'D', note: 'E', status: 'F', due_date: 'G' } },
  Commitee: { kind: 'Aktif', entity: 'organizer', headerRow: 1, columns: { name: 'A', day_role: 'C', contact: 'E' } },
  'Final New Volunteer': { kind: 'Aktif', entity: 'organizer', headerRow: 1, columns: { name: 'B', division: 'C', role: 'D', email: 'E', phone: 'F' } },
  LOGISTIC: { kind: 'Aktif', entity: 'logistic_need', headerRow: 1, columns: { no: 'A', item: 'C', vendor: 'E', qty: 'F', unit_price_idr: 'H', total_idr: 'I', pic: 'N', status_bayar: 'P' } },
  'Timeline Acara 2026 (Draft)': { kind: 'Draft', entity: 'agenda_block', headerRow: 1, columns: { zona: 'A', start: 'B', end: 'C', format: 'F', speaker: 'G', note: 'L' } },
  'Risk Register': { kind: 'Aktif', entity: 'risk', headerRow: 1, columns: { id: 'A', description: 'B', probability: 'C', impact: 'D', mitigation: 'E', owner: 'F' } },
  Agenda: { kind: 'Arsip', entity: 'agenda_block_2025', headerRow: 1, columns: {} },
};

export const DATA = {
  'Budget 2026 (Draft)': [
    ['Category', 'Item', 'Qty', 'Unit', 'Unit Price', 'Total', 'Note'],
    ['Venue', 'dBotanica', '1', 'lot', 'Rp 50.000.000', 'Rp 50.000.000', ''],
    ['Swag', 'T-shirt', '500', 'pcs', '75,000', '37.500.000', ''],
  ],
  'Budget 2026 - In Out': [
    ['Type', 'Source', 'Nominal', 'Status'],
    ['In', 'Sponsor', '100.000.000', 'DP'],
    ['Out', 'Belanja', '88.000.000', 'Lunas'],
  ],
  'Tiket 2026 (Draft)': [
    ['Tier', 'Includes', 'Price', 'Packages', 'Pax', 'Total', 'Note'],
    ['Developer', 'Full access', '150.000', '1', '250', '', ''],
    ['Builder', 'Workshop', '100.000', '1', '150', '', ''],
  ],
  'Target Partnership': [
    ['No', 'Company', 'PIC', 'Expected', 'Status', 'Note', 'Contact'],
    ['1', 'PT Telkom', 'Hana', '50.000.000', 'Dealing', '', '081234567890'],
  ],
  'MEDIA PARTNER': [
    ['Company', 'Category', 'Social', 'Email', 'Phone', 'Address', 'Terms'],
    ['Bia Donut', 'F&B', 'ig', 'a@b.com', '0812', 'addr', ''],
  ],
  '[LO] Speakers Candidate': [
    ['Name', 'Topic', 'Role', 'PIC', 'Note', 'Status'],
    ['Cleo Credo', 'Kotlin', 'Speaker', 'Kak Cendikia', '', 'BATAL'],
    ['Jason Stanley', 'Cloud', 'Speaker', 'Kak Cendikia', '', 'Done'],
  ],
  'General Task': [
    ['No', 'Title', 'Priority', 'PIC', 'Note', 'Status', 'Due'],
    ['1', 'Booking venue', 'High', 'Farhan', '', 'In-Progress', '2026-11-01'],
    ['2', 'Poster', 'Mid', '', '', 'TBC', ''],
  ],
  Commitee: [
    ['Name', 'Pre Day', 'Day Role', 'Shirt', 'Contact'],
    ['Farhan', 'PD', 'Coordinator', 'L', '08123456789'],
  ],
  'Final New Volunteer': [
    ['No', 'Name', 'Division', 'Role', 'Email', 'Phone', 'Occupation'],
    ['1', 'Farhan', 'Management', 'Coordinator', 'f@x.com', '+6281234567890', 'Dev'],
    ['2', 'Ayu', 'Design', 'Volunteer', 'ayu@x.com', '081298765432', 'Student'],
    ['3', 'Dup', 'Design', 'Volunteer', 'ayu@x.com', '081200000000', 'Student'],
  ],
  LOGISTIC: [
    ['No', '', 'Item', '', 'Vendor', 'Qty', 'Unit', 'Unit Price', 'Total', '', '', '', '', 'PIC', '', 'Status Bayar'],
    ['1', '', 'Sound', '', 'VendorA', '2', 'set', '5.000.000', '10.000.000', '', '', '', '', 'Farhan', '', 'DP'],
  ],
  'Timeline Acara 2026 (Draft)': [
    ['Zona', 'Start', 'End', 'Dur', 'Interval', 'Format', 'Speaker', 'Job', 'Topic', 'Asset', 'LO', 'Note'],
    ['Main Hall', '09:00', '10:00', '60', '60', 'Talk', 'Jason', '', '', '', '', 'note'],
  ],
  'Risk Register': [
    ['ID', 'Description', 'P', 'I', 'Mitigation', 'Owner'],
    ['R1', 'Venue belum fix', '3', '4', 'Backup venue', 'Farhan'],
  ],
  Agenda: [['anything']],
};

export function makeSheets(data = DATA) {
  return {
    async getValues(title) {
      return data[title] ?? [];
    },
    async batchGet(titles) {
      const out = {};
      for (const t of titles) out[t] = data[t] ?? [];
      return out;
    },
  };
}

export function makeRegistry(overrides = {}) {
  return loadRegistry({
    portfolio: { id: 'gdgc-bdg', name: 'GDG Cloud Bandung' },
    events: overrides.events ?? [
      { slug: 'devfest26', name: 'DevFest Cloud Bandung 2026', jenis: 'DevFest', year: 2026, folderId: 'F26', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_DEV', active: true, registryFile: 'planning.devfest26.json' },
      { slug: 'devfest25', name: 'DevFest Cloud Bandung 2025', jenis: 'DevFest', year: 2025, folderId: 'F25', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_PROD', active: false },
      { slug: 'master', name: 'Master Data', jenis: null, year: null, folderId: 'FM', spreadsheetIdEnv: 'PTX_SPREADSHEET_ID_MASTER', active: true, readOnly: true },
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
