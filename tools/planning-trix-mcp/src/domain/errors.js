// Error codes stabil: klien tidak perlu tahu detail Google.
export const ERROR_CODES = Object.freeze({
  E_CONFIG: 'E_CONFIG',
  E_EVENT_UNKNOWN: 'E_EVENT_UNKNOWN',
  E_TAB_NOT_FOUND: 'E_TAB_NOT_FOUND',
  E_SCHEMA_MISMATCH: 'E_SCHEMA_MISMATCH',
  E_VALIDATION: 'E_VALIDATION',
  E_WRITE_FORBIDDEN: 'E_WRITE_FORBIDDEN',
  E_AUTH: 'E_AUTH',
  E_UPSTREAM: 'E_UPSTREAM',
  E_INTERNAL: 'E_INTERNAL',
});

export class PtxError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PtxError';
    this.code = code;
    this.details = details;
  }
}

// Petakan status HTTP upstream ke kode stabil.
export function mapUpstreamStatus(status) {
  if (status === 401 || status === 403) return ERROR_CODES.E_AUTH;
  if (status === 404) return ERROR_CODES.E_TAB_NOT_FOUND;
  if (status === 429 || status >= 500) return ERROR_CODES.E_UPSTREAM;
  return ERROR_CODES.E_INTERNAL;
}

export function toErrorPayload(err) {
  if (err instanceof PtxError) {
    return { code: err.code, message: err.message, details: err.details };
  }
  return {
    code: ERROR_CODES.E_INTERNAL,
    message: err && err.message ? err.message : String(err),
    details: {},
  };
}