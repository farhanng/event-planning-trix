# System Design — Planning Trix Data Gateway (MCP)

- Status: Draft 0.2 (revisi dari 0.1)
- Tanggal: 27 Sep 2026
- Pasangan: `PRD.md`, `DATA-MODEL.md`

Perubahan 0.2: backend pindah dari `gws` CLI ke **Google Sheets API v4 + service
account**; aturan environment dev/prod; nama tab straight-forward; angka turunan
via formula; tambahan data plan + clean code structure.

---

## 1. Konteks & Constraint

- Sumber data: Google Sheets Planning Trix. Dua environment:
  - **prod** = spreadsheet panitia (read-only untuk tooling).
  - **dev** = salinan di folder Drive terpisah (semua perubahan di sini).
- Akses: **service account** + Google Sheets API v4. `gws` CLI tidak dipakai lagi.
- Host: mesin Gateway OpenClaw (`farhan-GL503VM`).
- OpenClaw memakai `mcp.servers` (stdio / Streamable HTTP / SSE) untuk MCP.
- Constraint: tanpa DB/service jaringan baru di fase awal; sesedikit mungkin
  moving parts; secret tidak masuk repo.

Status 27 Sep 2026: pembuatan salinan dev tertunda karena kuota Drive akun
pemegang OAuth penuh. Butuh kuota tambahan / shared drive / akun lain.

## 2. Keputusan Arsitektur

| # | Keputusan | Alasan | Alternatif ditolak |
| --- | --- | --- | --- |
| D1 | MCP server **stdio** | 1 host, tanpa port/TLS, lifecycle ikut Gateway | HTTP (perlu auth + expose port) |
| D2 | **Sheets API v4 + service account** | Tanpa CLI shell, typed client, retry/error native, mudah dites | `gws` CLI (parsing stdout rapuh, quirk keyring, `--json @file`) |
| D3 | **Registry** JSON sebagai satu sumber pemetaan | Kolom beda per tab; jangan hardcode | Hardcode per tool |
| D4 | **Dev/prod terpisah**; write dev-only | Production tidak boleh kena | Edit langsung di prod |
| D5 | Read-only dulu (Fase 0) | Hilangkan risiko data rusak | Langsung read+write |
| D6 | Normalisasi di server, bukan agent | Enum/tanggal/uang konsisten | Normalisasi di prompt |
| D7 | Lapor `conflicts[]`, tidak menebak | Sumber masih kotor | Auto-pilih nilai pertama |
| D8 | Angka turunan = **formula sheet** | Satu benar satu tempat; tool hanya baca | Hitung turunan di server (bisa beda dari sheet) |
| D9 | Kode berlapis **domain/infra/app** | Clean code, mudah tes, mudah ganti sumber | Satu file besar |

## 3. Arsitektur

```
            +-------------------------------+
 klien MCP  |  Claude Code / Cursor /       |
 (banyak)   |  agent devfest                |
            +---------------+---------------+
                            | MCP (stdio)
                            v
            +-------------------------------+
            |  planning-trix MCP server     |
            |-------------------------------|
            | app/       tool handlers      |
            | domain/    entities, enums,   |
            |            rules, normalizers |
            | infra/     sheets-client,     |
            |            registry, cache    |
            | config/    env, secrets       |
            | observability/ logger, audit  |
            +---------------+---------------+
                            | googleapis (Sheets v4)
                            v
            +-------------------------------+
            |  Google Sheets API v4         |
            |  (service account)            |
            +---------------+---------------+
                            |
          +-----------------+-----------------+
          v                                   v
  dev spreadsheet                      prod spreadsheet
  (editor, write ok)                   (viewer, read-only)
```

Lapisan (clean code):

- **domain**: entitas, enum, aturan bisnis, normalizer murni (tanpa I/O).
- **infra**: `SheetsClient` (bikin API call), `RegistryRepository`, cache.
- **app**: tool handler MCP, validasi input, rakit output.
- **config**: environment, env var, pembacaan secret.
- **observability**: logger terstruktur, audit log.

Arah dependensi satu arah: `app → domain`, `app → infra`, `infra → domain`.
Domain tidak pernah import infra (bisa dites tanpa jaringan).

## 4. Komponen

### 4.1 SheetsClient (`infra/sheets/SheetsClient.js`)

- Bungkus `googleapis` client (`sheets_v4.Sheets`).
- Auth: `GoogleAuth` dengan service-account key dari secret (bukan literal).
- Scope minimum: `https://www.googleapis.com/auth/spreadsheets.readonly` (Fase 0),
  `.../spreadsheets` untuk tulis (Fase 1).
- API yang dipakai: `spreadsheets.get` (metadata tab), `spreadsheets.values.batchGet`,
  `spreadsheets.values.update`/`clear`, `spreadsheets.batchUpdate` (format).
- Retry dengan exponential backoff + jitter untuk 429/5xx (pakai
  `google-auth-library`/`gaxios` bawaan, atau wrapper sendiri). Tidak retry 4xx validasi.
- Timeout per request; batasi ukuran respons; batching lintas tab dalam satu
  `batchGet`.

Contoh bentuk (pseudo):

```js
class SheetsClient {
  constructor({ auth, spreadsheetId }) { /* ... */ }
  async getSheetMeta() { /* titles + sheetId + grid */ }
  async batchGet(ranges, valueRenderOption = 'FORMATTED_VALUE') { /* ... */ }
  async update(range, values, { raw = true } = {}) { /* ... */ }
  async clear(range) { /* ... */ }
}
```

### 4.2 RegistryRepository (`infra/registry/`)

- Baca `registry/planning.json` sekali, validasi skema (zod), expose lookup
  `byEntity()` / `byTab()`.
- Registry: satu baris per tab → `{ title, kind, entity, headerRow, revRow, columns }`.
- `kind: Aktif | Referensi | Arsip`. Tab `Arsip` ditolak jalur tulis.
- Validasi saat start: setiap tab di registry ada di sheet; kalau tidak →
  warning, bukan crash.

### 4.3 Normalizer (`domain/normalize/`, pure)

- `normalizeStatus(raw, enum, map)` → enum kanonik + `raw_status`.
- `normalizeMoney(v)` → integer IDR (terima `57000000` dan `"Rp28.000.000"`).
- `normalizeDate(v)` → `YYYY-MM-DD` + `raw` + flag `ambiguous`.
- `normalizePhone(v)` → `+62 ...` (tiga format lama dinormalkan).
- `normalizeBoolean(v)` → `Ya` / `Tidak`.
- Semua fungsi murni, tanpa I/O → tes unit murah.

### 4.4 Tool handlers (`app/tools/`)

- Satu file per tool; tiap handler: validasi input (zod) → panggil repo/client →
  normalisasi → rakit `{ok, data, meta}`.
- Tidak ada akses sheet langsung di handler; lewat composable service
  (`BudgetService`, `SpeakerService`, dst.) supaya logika domain bisa dipakai
  ulang dan dites tanpa MCP.

### 4.5 Validator tulis (`domain/rules/`, Fase 1)

- Tolak tab `Arsip`.
- Status wajib enum; nilai luar enum ditolak.
- PIC + deadline wajib (`TBD` eksplisit boleh).
- Wajib read-back range target; wajib update `Rev.`; wajib catatan revisi.
- Clear blok sebelum tulis; pad semua baris ke lebar blok.

### 4.6 Observability (`observability/`)

- Logger JSON terstruktur: `{ts, level, tool, durationMs, rows, warnings, conflicts}`.
- Audit log JSONL append-only untuk operasi tulis:
  `{ts, env, tool, args, ranges, before, after, result}`.
- Lokasi `var/audit/planning-trix.jsonl` (gitignored, lokal).

## 5. Environment & Konfigurasi

Env var:

| Nama | Isi |
| --- | --- |
| `PTX_ENV` | `dev` (default) atau `prod` |
| `PTX_SPREADSHEET_ID_DEV` | id spreadsheet dev |
| `PTX_SPREADSHEET_ID_PROD` | id spreadsheet prod |
| `GOOGLE_APPLICATION_CREDENTIALS` | path service-account key (secret) |
| `PTX_LOG_LEVEL` | `info` default |
| `PTX_AUDIT_PATH` | path audit log |

Aturan:

- `PTX_ENV=prod` → client dipaksa read-only (scope readonly, tool tulis disabled).
- Spreadsheet id tidak pernah masuk kode; selalu dari env.
- Kunci SA tidak masuk repo; disediakan lewat secret store / path di luar repo.

## 6. Kontrak Tool (Fase 0)

Bentuk respons seragam:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "env": "dev",
    "source_tabs": [],
    "rev": null,
    "fetched_at": "2026-09-27T15:00:00Z",
    "warnings": [],
    "conflicts": []
  }
}
```

| Tool | Input | Output inti |
| --- | --- | --- |
| `planning_index` | `{kind?}` | `tabs[]{title,kind,purpose,issues,owner,action}` |
| `budget_summary` | `{scenario?}` | `lines[], subtotal_idr, buffer_idr, total_out_idr, income{}, gap_idr, sponsor_target_idr, scenarios[], notes[]` |
| `ticket_summary` | `{}` | `tiers[]{name,includes,price_idr,packages,pax,total_idr,note}, total_ticket_idr, avg_per_pax_idr` |
| `sponsor_pipeline` | `{}` | `packages[]{...}, targets_idr, prospects[]{...}` |
| `speaker_candidates` | `{status?,pic?,include_ref?}` | `candidates[]{name,topic,role,pic,status,status_raw,notes}` |
| `task_list` | `{pic?,status?,overdue_before?,source?}` | `tasks[]{id,task,pic,deadline,status,note,source_tab}` |
| `logistic_needs` | `{division?}` | `needs[]{...}, vendors[]{...}` |
| `agenda_zona` | `{zona?}` | `blocks[]{zona,start,end,duration,session,format,pic,note}` |

## 7. Jalur Tulis (Fase 1, dev-only)

```
call(task_upsert)
  -> validate zod schema
  -> domain rules: enum + PIC/deadline + tab bukan Arsip
  -> refuse if PTX_ENV == "prod"
  -> approval prompt (operator)
  -> clear block -> values.update (RAW, padded)
  -> read-back exact cells
  -> update Rev. row + append revision note
  -> audit log
  -> return before/after
```

## 8. Error Handling

Semua error dipetakan ke kode stabil (client tidak perlu tahu detail Google):

| Kondisi | Kode |
| --- | --- |
| API 401/403 | `E_AUTH` |
| API 404 / tab hilang | `E_TAB_NOT_FOUND` |
| API 429/5xx habis retry | `E_UPSTREAM` |
| Header tidak cocok registry | `E_SCHEMA_MISMATCH` |
| Input tidak lolos validasi | `E_VALIDATION` |
| Tulis ke tab arsip / prod | `E_WRITE_FORBIDDEN` |
| Nilai di luar enum | `warning` + field `unknown` (bukan fatal) |
| Konflik angka | `meta.conflicts[]`, `ok` tetap true |

## 9. Keamanan

- Service-account key: secret store / path di luar repo, scope minimum.
- Prod selalu read-only. Tulis hanya dev + approval.
- Tab arsip read-only.
- Data budget, sponsor, kontak eksternal: internal.
- Audit log lokal, tanpa rahasia; rotasi kunci SA berkala.

## 10. Deployment

```bash
# build
npm ci && npm run build

# registrasi MCP (stdio), env diset di config server
openclaw mcp add planning-trix \
  --command node \
  --arg <path>/dist/index.js \
  --env PTX_ENV=dev \
  --env PTX_SPREADSHEET_ID_DEV=<id>

openclaw mcp doctor planning-trix --probe
```

- Fase 0 expose hanya tool baca (`openclaw mcp tools planning-trix --include ...`).
- Kalau host pindah mesin: butuh Node + kunci SA + env yang sama.

## 11. Struktur Repo (usulan)

```
tools/planning-trix-mcp/
  package.json                 # type: module, engines >=22
  src/
    index.js                   # entry MCP stdio
    config/env.js              # baca env + validasi
    domain/
      entities/               # Task, BudgetLine, SpeakerCandidate, ...
      enums.js                # enum kanonik (single source)
      normalize/              # status, money, date, phone, boolean
      rules/                  # aturan validasi tulis
      services/               # BudgetService, SpeakerService, ...
    infra/
      sheets/SheetsClient.js
      sheets/auth.js
      registry/RegistryRepository.js
      registry/planning.json
      cache/memory-cache.js
    app/
      tools/                  # 1 file per tool MCP
      output/format.js        # JSON + ringkasan teks
    observability/
      logger.js
      audit.js
  test/
    unit/                     # normalizer, rules, services (tanpa jaringan)
    contract/                 # handler vs fixture
    fixtures/                 # respons Sheets API tersimpan
  registry/planning.json      # (atau di src/infra/registry)
```

## 12. Rencana Tes

- **Unit** (tanpa I/O): normalizer, enum mapping, rules, services dengan repo palsu.
- **Contract**: tiap handler diuji terhadap fixture respons Sheets API (bentuk
  nyata yang disimpan), memastikan field output stabil.
- **Integrasi** (opt-in, dev): panggilan nyata read-only + cek bentuk.
- **Negatif**: tab arsip ditolak, prod write ditolak, header mismatch, enum luar,
  error API dipetakan ke kode stabil.
- **Probe**: `openclaw mcp doctor planning-trix --probe` melaporkan semua tool.

## 13. Observability

- Log tiap tool call: nama, env, durasi, jumlah baris, warning, conflict.
- Tidak log isi kontak penuh kecuali debug.
- `meta.warnings[]` + `meta.conflicts[]` = sinyal kualitas data.

## 14. Milestone Teknis

- M0: config + SheetsClient + registry + normalizer + tes unit.
- M1: 8 tool baca + tes kontrak + `mcp add` + probe hijau (dev).
- M2: 3 tool tulis + validator + audit + approval (dev).
- M3: resource + sinkron memori.
- M4: cutover prod (checklist PRD bagian 12).

## 15. Alternatif yang Dipertimbangkan

- **`gws` CLI sebagai backend**: ditolak (parsing stdout rapuh, quirk keyring,
  `--json @file` tidak didukung, error handling berbasis teks).
- **HTTP MCP server**: ditolak untuk fase awal (butuh auth + expose port).
- **Apps Script web app**: ditolak (surface publik + auth sendiri).
- **Cache penuh spreadsheet lokal**: ditunda ke Fase 2 (risiko stale; butuh TTL).
- **Hitung turunan di server**: ditolak; turunan tetap formula sheet supaya
  panitia dan agent melihat angka yang sama.