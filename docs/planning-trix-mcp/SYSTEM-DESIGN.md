# System Design — Planning Trix Data Gateway (MCP)

- Status: Draft 0.3 (revisi dari 0.2)
- Tanggal: 27 Sep 2026
- Pasangan: `PRD.md`, `DATA-MODEL.md`

Perubahan 0.3: **dimensi event** jadi kelas satu (1 event = 1 spreadsheet =
1 folder Drive); `ORGANIZER` tunggal untuk committee+volunteer + tabel
`ASSIGNMENT`; registry naik jadi **katalog multi-event**; tool wajib
menyebut `event` eksplisit.

Perubahan 0.2: backend pindah dari `gws` CLI ke **Google Sheets API v4 + service
account**; aturan environment dev/prod; nama tab straight-forward; angka turunan
via formula; tambahan data plan + clean code structure.

---

## 1. Konteks & Constraint

- Sumber data: Google Sheets Planning Trix, **satu file per event**. Hierarki:
  `Portfolio → Event → Spreadsheet → Tab` (lihat `DATA-MODEL.md` bagian 2).
- Dua environment:
  - **prod** = spreadsheet panitia (read-only untuk tooling).
  - **dev** = salinan di folder Drive terpisah (semua perubahan di sini).
  - Konvensi operasional panitia: event baru → folder Drive baru + Planning Trix
    baru. Jadi data dua tahun **tidak mungkin** satu file; kalau ketemu satu file
    berisi dua tahun, itu anomali yang harus dipecah.
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
| D10 | **Event sebagai parameter wajib** tiap tool | Satu file per event; tidak ada tebak-tebakan "yang terbaru" | Default ke event terbaru (rawan salah tulis) |
| D11 | **Registry = katalog multi-event** | 5 file trix aktif + template; satu sumber pemetaan | Satu registry per event (duplikasi & drift) |
| D12 | **ORGANIZER tunggal + ASSIGNMENT** | Committee & volunteer orang yang sama; role banyak | Dua tabel orang (dedup manual terus-menerus) |

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

Satu server melayani **banyak event**. Registry memegang katalog event, jadi
permintaan `task_list{event:"devfest26"}` dan `task_list{event:"cloudnext26"}`
lewat jalur yang sama tanpa kode per event.

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
  `events()` / `byEntity()` / `byTab()`.
- Registry dua lapis:
  1. **`events[]`** — katalog event: `{ slug, name, jenis, year, folderId,
     spreadsheetIdEnv, access }`. Ini yang membuat dimensi event jalan.
  2. **`tabs[]`** per event — `{ title, kind, entity, headerRow, revRow,
     columns, derivedFrom? }`. Field kanoniknya `snake_case`.
- `kind: Aktif | Referensi | Arsip | Draft | Turunan`. Tab `Arsip` dan `Draft`
  ditolak jalur tulis; `Turunan` wajib tulis dan wajib punya `derivedFrom`.
- Resolusi env: `spreadsheetIdEnv` (mis. `PTX_SPREADSHEET_ID_DEVFEST26`), tidak
  pernah id literal.
- Validasi saat start: tiap tab di registry ada di sheet → kalau tidak, warning;
  tiap `derivedFrom` menunjuk tab yang ada; tiap event punya 1 `Overview`.

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
| `PTX_SPREADSHEET_ID_<EVENT>` | id spreadsheet per event, mis. `PTX_SPREADSHEET_ID_DEVFEST26`, `PTX_SPREADSHEET_ID_DEV_DEVFEST26` |
| `PTX_DEV_OVERLAY` | `1` = semua event dibaca dari salinan dev; `0` = prod read-only |
| `GOOGLE_APPLICATION_CREDENTIALS` | path service-account key (secret) |
| `PTX_LOG_LEVEL` | `info` default |
| `PTX_AUDIT_PATH` | path audit log |

Aturan:

- `PTX_ENV=prod` → client dipaksa read-only (scope readonly, tool tulis disabled).
- Spreadsheet id tidak pernah masuk kode; selalu dari env, per event.
- Tool baca/tulis **wajib** terima `event` (slug dari katalog registry); slug tak
  dikenal → `E_EVENT_UNKNOWN`, bukan tebak default.
- Operasi lintas event (mis. `Report`, perbandingan peserta) harus eksplisit
  mengirim daftar event; tidak boleh "semua event" implisit.
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
| `event_catalog` | `{year?,jenis?}` | `events[]{slug,name,jenis,year,folder_id,spreadsheet_ref}` |
| `planning_index` | `{event, kind?}` | `tabs[]{title,kind,entity,purpose,issues,owner_pic,action,derived_from}` |
| `budget_summary` | `{event, scenario?}` | `lines[], subtotal_idr, buffer_idr, total_out_idr, income{}, gap_idr, sponsor_target_idr, scenarios[], notes[]` |
| `ticket_summary` | `{event}` | `tiers[]{name,includes,price_idr,packages,pax,total_idr,note}, total_ticket_idr, avg_per_pax_idr` |
| `partnership_pipeline` | `{event, tipe?}` | `packages[]{...}, deals[]{company,tipe,pic,expected_idr,status,contact}` |
| `speaker_candidates` | `{event, status?,pic?,include_ref?}` | `candidates[]{name,topic,role,pic,status,status_raw,notes}` |
| `task_list` | `{event, pic?,status?,overdue_before?,source?}` | `tasks[]{id,wbs,title,pic,division,due_date,status,note,source_tab}` |
| `organizer_list` | `{event, division?,position?,tipe?}` | `organizers[]{id,name,email,phone,tipe,assignments[]{division,position,scope,status}}` |
| `logistic_needs` | `{event, division?}` | `needs[]{...}, orders[]{...}, vendors[]{...}, payments[]{...}` |
| `agenda_zona` | `{event, zona?}` | `blocks[]{zona,start,end,duration,format,speaker,pic,note}` |
| `risk_register` | `{event, min_score?}` | `risks[]{id,description,category,probability,impact,score,mitigation,contingency,owner}` |

Catatan: `partnership_pipeline` menggantikan `sponsor_pipeline` karena prospek
kini satu entitas dengan media partner/community (`PARTNERSHIP_DEAL`).
`organizer_list` baru karena committee+volunteer jadi satu entitas + penugasan.

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

- Fase 0 expose hanya 11 tool baca (`openclaw mcp tools planning-trix --include ...`).
- Kalau host pindah mesin: butuh Node + kunci SA + env yang sama.

## 10b. Aturan Multi-Event (operasional)

1. Event baru = folder Drive baru + spreadsheet baru; tidak ada penambahan tahun
   ke file lama.
2. `EVENT_TAB.kind` wajib; tab tanpa kind ditolak jalur tulis dan diberi warning
   di `planning_index`.
3. Data lama yang masih menempel di file baru (kasus sekarang: 25+ tab legacy
   2025 di file 2026) **tidak dipindah manual ke file 2025**. Keputusan Kak
   Farhan 27 Sep 2026: **production baru dibangun ulang** dari standar (file
   baru), lalu data hidup 2026 dimigrasikan saat cutover; file lama dibiarkan
   apa adanya. Dev dipakai untuk uji tulis. Lihat PRD bagian 14.
4. Referensi lintas event (Master Data volunteer, Asset Inventory, Templates)
   dibaca dari registry `master` dan bersifat read-only.
5. Template resmi (folder `Templates`) dijadikan `TEMPLATE_REFERENCE`, bukan
   disalin manual tiap event.

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
      registry/events.json       # katalog event (slug -> spreadsheet env)
      registry/planning.json     # tab -> entity per event
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
  registry/events.json        # katalog event, diresolve ke env var
```

## 12. Rencana Tes

- **Unit** (tanpa I/O): normalizer, enum mapping, rules, services dengan repo palsu.
- **Registry**: setiap slug event resolve ke env var; tab tanpa `kind` tertolak;
  `derivedFrom` menunjuk tab nyata; tidak ada duplikat `(tab, event)`.
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

- M0: config + SheetsClient + registry (katalog event) + normalizer + tes unit.
- M1: 11 tool baca + tes kontrak + `mcp add` + probe hijau (dev).
- M2: 4 tool tulis + validator + audit + approval (dev).
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
- **Satu registry untuk semua event**: ditolak; katalog event + registry per
  event, karena skema tab antar event memang beda (2025: 41 tab, 2026: 57 tab).
- **Menggabungkan committee & volunteer jadi dua tabel**: ditolak; satu
  `ORGANIZER` + `ASSIGNMENT` (feedback Kak Farhan 27 Sep 2026).