import { PtxError, ERROR_CODES } from '../domain/errors.js';

const DEFAULT_ENV = 'dev';
const ALLOWED = Object.freeze(['dev', 'prod']);

export function resolveEnvName(value) {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return DEFAULT_ENV;
  if (!ALLOWED.includes(v)) throw new PtxError(ERROR_CODES.E_CONFIG, `PTX_ENV harus 'dev' atau 'prod', dapat '${value}'`);
  return v;
}

export function spreadsheetIdFor(envName, env = process.env) {
  const key = `PTX_SPREADSHEET_ID_${envName.toUpperCase()}`;
  const id = (env[key] ?? '').trim();
  if (!id) throw new PtxError(ERROR_CODES.E_CONFIG, `Env ${key} belum diisi`);
  return id;
}

export function loadConfig(env = process.env) {
  const envName = resolveEnvName(env.PTX_ENV);
  return {
    env: envName,
    spreadsheetId: spreadsheetIdFor(envName, env),
    keyFile: (env.PTX_SA_KEY_FILE ?? '').trim() || null,
    registryPath: (env.PTX_REGISTRY ?? 'registry/planning.json').trim(),
    readOnly: envName === 'prod',
    defaultEvent: (env.PTX_DEFAULT_EVENT ?? '').trim() || null,
  };
}