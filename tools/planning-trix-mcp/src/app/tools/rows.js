export function colToIndex(letter) {
  if (typeof letter !== 'string' || letter === '') return null;
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return null;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

export function cellAt(row, letter) {
  const idx = colToIndex(letter);
  if (idx == null || !Array.isArray(row)) return null;
  const value = row[idx];
  return value === undefined ? null : value;
}

export function rangeFor(title, columns) {
  const letters = Object.values(columns ?? {}).filter((c) => typeof c === 'string' && c);
  if (letters.length === 0) return `${title}`;
  const indexes = letters.map(colToIndex).filter((i) => i != null);
  const max = Math.max(...indexes);
  return `'${title}'!A:${String.fromCharCode(65 + max)}`;
}

export function mapRows(values, { headerRow = 1, columns = {} } = {}) {
  const rows = Array.isArray(values) ? values : [];
  const body = rows.slice(Math.max(0, Number(headerRow) || 1));
  const fields = Object.entries(columns).filter(([, col]) => typeof col === 'string' && col);
  return body
    .map((row) => {
      const obj = {};
      for (const [field, col] of fields) obj[field] = cellAt(row, col);
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v != null && String(v).trim() !== ''));
}