export function envelope(data, meta = {}, summary = []) {
  return { ok: true, data, meta: { ...meta }, summary };
}

export function errorEnvelope(error, meta = {}) {
  return { ok: false, error, meta: { ...meta } };
}

export function toWaText(summary) {
  return (summary ?? []).filter((line) => line != null && String(line).trim() !== '').join('\n');
}

export function toMcpResult(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }], isError: payload?.ok === false };
}