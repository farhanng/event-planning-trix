import { GoogleAuth } from 'google-auth-library';
import { PtxError, mapUpstreamStatus } from '../../domain/errors.js';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export function defaultMakeAuth(cfg) {
  return new GoogleAuth({
    scopes: cfg.readOnly
      ? ['https://www.googleapis.com/auth/spreadsheets.readonly']
      : ['https://www.googleapis.com/auth/spreadsheets'],
    ...(cfg.keyFile ? { keyFile: cfg.keyFile } : {}),
  });
}

export async function defaultToken(cfg, makeAuth = defaultMakeAuth) {
  const client = await makeAuth(cfg).getClient();
  const token = await client.getAccessToken();
  const value = token && typeof token === 'object' ? token.token : token;
  if (typeof value !== 'string' || value === '') {
    throw new PtxError('E_AUTH', 'Gagal mengambil access token service account');
  }
  return value;
}

export function createSheetsClient(cfg, deps = {}) {
  const makeAuth = deps.makeAuth ?? defaultMakeAuth;
  const getToken = deps.getToken ?? (() => defaultToken(cfg, makeAuth));
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const base = `${BASE_URL}/${cfg.spreadsheetId}`;

  async function request(pathAndQuery, init = {}) {
    const token = await getToken();
    const res = await fetchImpl(`${base}${pathAndQuery}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      throw new PtxError(mapUpstreamStatus(res.status), `Sheets API menolak (${res.status})`, { status: res.status });
    }
    return res.json();
  }

  return {
    async getValues(title) {
      const query = new URLSearchParams({ majorDimension: 'ROWS' }).toString();
      const res = await request(`/values/${encodeURIComponent(title)}?${query}`, { method: 'GET' });
      return res.values ?? [];
    },
    async batchGet(titles) {
      const params = new URLSearchParams({ majorDimension: 'ROWS' });
      for (const title of titles) params.append('ranges', title);
      const res = await request(`/values:batchGet?${params.toString()}`, { method: 'GET' });
      const out = {};
      titles.forEach((title) => {
        out[title] = [];
      });
      (res.valueRanges ?? []).forEach((range, i) => {
        out[titles[i]] = range.values ?? [];
      });
      return out;
    },
  };
}
