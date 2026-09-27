// Normalizer murni (tanpa I/O). Semua fungsi menerima nilai mentah dari sheet.

export function clean(value) {
  if (value == null) return null;
  const s = String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

export function toInt(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const s = String(value).replace(/[^\d-]/g, '');
  if (s === '' || s === '-') return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// Uang -> integer IDR. Menangani "Rp 2.500.000", "1,500,000", angka mentah.
export function toMoney(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  let s = String(value).replace(/\u00a0/g, ' ').replace(/rp/i, '').replace(/\s/g, '').trim();
  if (s === '') return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const MONTHS = Object.freeze({
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
});

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function monthNumber(name) {
  const key = clean(name);
  if (!key) return null;
  return MONTHS[key.slice(0, 3).toLowerCase()] ?? null;
}

// Tanggal -> ISO YYYY-MM-DD. Menerima Date, "2026-11-28", "28/11/2026", "28 Nov 2026".
export function toIsoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const s = clean(value);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})$/.exec(s);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${pad2(m[2])}-${pad2(m[1])}`;
  }
  m = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(s);
  if (m) {
    const mo = monthNumber(m[2]);
    if (mo) return `${m[3]}-${pad2(mo)}-${pad2(m[1])}`;
  }
  return null;
}

// Nomor HP -> format kanonik +62xxxxxxxxxx.
export function toPhone(value) {
  const s = clean(value);
  if (!s) return null;
  let d = s.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (!d.startsWith('62')) d = `62${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return `+${d}`;
}

const TRUE_WORDS = Object.freeze(['ya', 'yes', 'true', '1', 'y', 'iya']);
const FALSE_WORDS = Object.freeze(['tidak', 'no', 'false', '0', 'n', 'belum']);

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  const s = clean(value);
  if (!s) return null;
  const key = s.toLowerCase();
  if (TRUE_WORDS.includes(key)) return true;
  if (FALSE_WORDS.includes(key)) return false;
  return null;
}