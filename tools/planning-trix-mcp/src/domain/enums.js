import { clean } from './normalize.js';

export const ENUMS = Object.freeze({
  taskStatus: Object.freeze(['Belum Mulai', 'Proses', 'Terblokir', 'Selesai', 'Batal', 'N/A']),
  payment: Object.freeze(['Belum Bayar', 'DP', 'Lunas']),
  prioritas: Object.freeze(['High', 'Mid', 'Low']),
  zona: Object.freeze(['Main Hall', 'Workshop', 'Auditorium', 'Foyer', 'Kids Zone']),
  tipePartner: Object.freeze(['Sponsor', 'Media Partner', 'Community', 'In-Kind']),
  statusKontak: Object.freeze(['Belum Dikontak', 'Dihubungi', 'Dealing', 'Win', 'Batal']),
  tabKind: Object.freeze(['Aktif', 'Referensi', 'Arsip', 'Draft', 'Turunan']),
});

// Peta nilai lama -> enum kanonik. Kunci selalu lowercase.
export const STATUS_MAP = Object.freeze({
  'not started': 'Belum Mulai',
  'to do': 'Belum Mulai',
  todo: 'Belum Mulai',
  tbc: 'Belum Mulai',
  'in-progress': 'Proses',
  'in progress': 'Proses',
  'on progress': 'Proses',
  process: 'Proses',
  doing: 'Proses',
  soon: 'Proses',
  proses: 'Proses',
  done: 'Selesai',
  completed: 'Selesai',
  selesai: 'Selesai',
  aktif: 'Selesai',
  cancel: 'Batal',
  cancelled: 'Batal',
  batal: 'Batal',
  terblokir: 'Terblokir',
  blocked: 'Terblokir',
  lunas: 'Lunas',
  dp: 'DP',
  'belum bayar': 'Belum Bayar',
  'n/a': 'N/A',
  na: 'N/A',
});

// Nilai tak terpetakan -> 'unknown' (bukan ditebak).
export function mapStatus(raw) {
  const value = clean(raw);
  if (value == null) return { status: 'unknown', raw_status: null };
  if (ENUMS.taskStatus.includes(value)) return { status: value, raw_status: value };
  const mapped = STATUS_MAP[value.toLowerCase()];
  return { status: mapped ?? 'unknown', raw_status: value };
}

export function mapEnum(raw, allowed) {
  const value = clean(raw);
  if (value == null) return 'unknown';
  const hit = (allowed ?? []).find((a) => a.toLowerCase() === value.toLowerCase());
  return hit ?? 'unknown';
}