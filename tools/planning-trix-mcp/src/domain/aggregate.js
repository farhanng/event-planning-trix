export function sumBy(items, key) {
  return (items ?? []).reduce(
    (acc, item) => acc + (typeof item?.[key] === 'number' ? item[key] : 0),
    0,
  );
}

// Dedup stabil: item pertama menang, dipakai untuk merge ORGANIZER.
export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items ?? []) {
    const key = keyFn(item);
    if (key == null) {
      out.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}