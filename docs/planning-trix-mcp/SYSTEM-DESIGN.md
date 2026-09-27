# System Design — Planning Trix Data Gateway (MCP)

- Status: Draft
- Versi: 0.1
- Tanggal: 27 Sep 2026
- Pasangan dokumen: `PRD.md`

---

## 1. Konteks & Constraint

- Sumber data: Google Sheets Planning Trix
  `<SPREADSHEET_ID>` (56 tab).
- Akses yang sudah ada: CLI `gws` v0.22.5 di `~/.local/bin/gws`, OAuth Kak
  Farhan. Tidak ada kredensial tambahan yang diinginkan.
- Host: mesin yang sama dengan Gateway OpenClaw (`farhan-GL503VM`).
- OpenClaw mendukung MCP server lewat `mcp.servers` (transport stdio,
  Streamable HTTP, SSE). Server dikelola via `openclaw mcp add/list/probe/doctor`.
- Constraint: sesedikit mungkin moving parts; tidak menambah DB atau service
  jaringan baru di fase awal.

## 2. Keputusan Arsitektur

| # | Keputusan | Alasan | Alternatif ditolak |
| --- | --- | --- | --- |
| D1 | MCP server **stdio**, bukan HTTP | 1 host, tanpa port/TLS, lifecycle ikut Gateway | HTTP (butuh auth + expose port) |
| D2 | Backend = subprocess `gws` | Pakai OAuth yang sudah ada, tanpa SDK Google baru | Google API client langsung (kredensial baru) |
| D3 | Registry JSON sebagai satu sumber pemetaan | Kolom beda per tab; jangan hardcode di kode/prompt | Hardcode per tool (rapuh) |
| D4 | Read-only dulu | Menghilangkan risiko data rusak | Langsung read+write (risiko tinggi) |
| D5 | Normalisasi di server, bukan di agent | Enum/tanggal/uang konsisten di semua klien | Normalisasi di prompt (tidak konsisten) |
| D6 | Lapor `conflicts[]`, tidak menebak | Sumber masih kotor (angka bentrok) | Auto-pilih nilai pertama (bahaya) |

## 3. Arsitektur

```
                 +---------------------------+
 klien MCP        |  Claude Code / Cursor /   |
 (banyak)         |  agent devfest            |
                 +-------------+-------------+
                               | MCP (stdio)
                               v
                 +---------------------------+
                 |   planning-trix MCP server |
                 |---------------------------|
                 | tools/    index.js         |
                 | registry/ planning.json    |
                 | adapters/ gws.js           |
                 | normalize/ status|money|date|
                 | validate/ write-rules.js   |
                 | audit/    log.jsonl        |
                 +-------------+-------------+
                               | exec (stdin/args, JSON out)
                               v
                 +---------------------------+
                 |   gws CLI  (OAuth Kak Farhan)|
                 +-------------+-------------+
                               | HTTPS
                               v
                 +---------------------------+
                 |  Google Sheets Planning   |
                 |  Trix (56 tab)            |
                 +---------------------------+
```

Agent tidak pernah membaca sel mentah. Ia memanggil tool domain dan menerima
objek ternormalisasi.

## 4. Komponen

### 4.1 MCP Server (entry)

- Runtime: Node ≥ 22 (host punya v26). SDK `@modelcontextprotocol/sdk`
  (sudah tersedia di instalasi OpenClaw, tapi repo membawa dependensi sendiri).
- Transport: stdio.
- Tanggung jawab: registrasi tool, validasi input (schema), pemanggilan
  adapter, normalisasi, perakitan output, pembentukan error.

### 4.2 Registry (`registry/planning.json`)

Satu file memetakan tab → entitas, header, kolom, enum, dan status arsip.
Kode tool membaca registry, bukan menulis indeks kolom.

```json
{
  "spreadsheetId": "<SPREADSHEET_ID>",
  "statusEnum": ["Belum Mulai","Proses","Terblokir","Selesai","Batal","N/A"],
  "statusMap": {
    "Not Started": "Belum Mulai", "To do": "Belum Mulai",
    "In-Progress": "Proses", "In Progress": "Proses",
    "On Progress": "Proses", "PROCESS": "Proses", "Doing": "Proses",
    "Done": "Selesai", "Completed": "Selesai",
    "LUNAS": "Selesai", "Aktif": "Selesai"
  },
  "tabs": [
    {
      "title": "Budget 2026 (Draft)",
      "kind": "Aktif",
      "entity": "budget_line",
      "headerRow": 4,
      "revRow": 2,
      "columns": {
        "category": "A", "item": "B", "qty": "C", "unit": "D",
        "unit_price": "E", "total": "F", "note": "G"
      }
    },
    {
      "title": "[LO] Speakers Candidate",
      "kind": "Aktif",
      "entity": "speaker_candidate",
      "headerRow": 1,
      "columns": {
        "name": "A", "topic": "B", "role": "C", "pic": "D",
        "notes": "E", "status": "F"
      }
    }
  ]
}
```

Catatan: `spreadsheetId` di atas diisi saat implementasi; jangan hardcode di
kode tool. Tab ber-`kind: "Arsip"` ditolak jalur tulis.

### 4.3 Adapter `gws.js`

- `batchGet(tabs, a1)` → satu panggilan untuk banyak tab.
- `update(tab, range, values)` → jalur tulis.
- Menangani quirk `gws` (terverifikasi di skill):
  - Buang baris `Using keyring backend: keyring` sebelum `JSON.parse`.
  - Error API: parse hanya objek `{...}` pertama (`raw_decode`), baca pesan
    dari `error[api]` / `error[validation]`.
  - `--params` untuk query, `--json` untuk body. `--json @file` tidak didukung.
  - `valueInputOption: RAW` supaya nomor telepon berawalan `+` tidak jadi angka; `USER_ENTERED`
    merusak nomor telepon.
- Retry terbatas (2x) untuk error jaringan; tidak retry untuk error validasi.

### 4.4 Normalizer

- `status`: map via `statusMap`; tak dikenal → `unknown` + `raw_status`.
- `money`: `"Rp28.000.000"` / `57000000` → integer IDR.
- `date`: `9/5`, `05/12/2025`, `28 Nov 2026`, ISO → `YYYY-MM-DD` + `raw`.
  Format ambigu (`9/5`) ditandai `ambiguous: true`, tidak ditebak.
- `phone`: `6281200000000` / `(+62) 812-...` / `+62812-...` → `+62 812-0000-0000`.
- `bool`: `TRUE/FALSE` → `Ya/Tidak`.

### 4.5 Validator (jalur tulis, Fase 1)

- Tolak tab `kind: "Arsip"`.
- `status` wajib ada di enum kanonik.
- `PIC` dan `deadline` wajib (boleh `TBD`, tapi harus eksplisit).
- Wajib read-back range target setelah tulis.
- Wajib update `Rev.` di baris 2 + tambah catatan revisi ber-nomor.
- Clear blok sebelum tulis (hindari sel sisa) dan pad semua baris ke lebar blok.

### 4.6 Audit log

- JSONL append-only: `{ts, tool, args, tabs, ranges, before, after, result}`.
- Lokasi: `var/audit/planning-trix.jsonl` (di-gitignore, hanya lokal).

## 5. Kontrak Tool (Fase 0)

Semua tool mengembalikan bentuk seragam:

```json
{
  "ok": true,
  "data": {},
  "meta": { "source_tabs": [], "rev": null, "fetched_at": "ISO", "warnings": [], "conflicts": [] }
}
```

### 5.1 `planning_index`

- Input: `{ "kind": "Aktif|Referensi|Draft|Legacy|Duplikat|Arsip" }` (opsional)
- Output: `data.tabs[] { title, kind, purpose, issues, owner, action }`

### 5.2 `budget_summary`

- Input: `{ "scenario": "all|belanja|inout|tiket" }`
- Output:
  - `data.lines[] { category, item, qty, unit, unit_price_idr, total_idr, note }`
  - `data.subtotal_idr`, `data.buffer_idr`, `data.total_out_idr`
  - `data.income { google_idr, ticket_idr, sponsor_idr }`
  - `data.gap_idr`, `data.sponsor_target_idr`
  - `data.scenarios[] { label, gap_idr }`
  - `data.notes[]`
- Konflik: `meta.conflicts[]` bila total/angka kunci beda antar tab.

### 5.3 `ticket_summary`

- Output: `data.tiers[] { name, includes, price_idr, packages, pax, total_idr, note }`,
  `data.total_ticket_idr`, `data.avg_per_pax_idr`.

### 5.4 `sponsor_pipeline`

- Output: `data.packages[] { name, slots, price_idr, potential_idr, note }`,
  `data.targets_idr`, `data.prospects[] { company, pic, expected_usd, status, note }`.

### 5.5 `speaker_candidates`

- Input: `{ "status": "<enum|raw>", "pic": "string", "include_ref": true }`
- Output: `data.candidates[] { name, topic, role, pic, status, status_raw, notes }`

### 5.6 `task_list`

- Input: `{ "pic": "string", "status": "enum", "overdue_before": "YYYY-MM-DD",
  "source": "General Task|Task OBJ *" }`
- Output: `data.tasks[] { id, task, pic, deadline, status, note, source_tab }`
- Baris tanpa PIC/deadline → `pic: null`, `deadline: null` (jangan dikarang).

### 5.7 `logistic_needs`

- Output: `data.needs[] { division, item, qty, notes, status }`,
  `data.vendors[] { item, vendor, contact, note }`.

### 5.8 `agenda_zona`

- Input: `{ "zona": "global|main_hall|workshop|auditorium" }`
- Output: `data.blocks[] { zona, start, end, duration, session, format, pic, note }`

## 6. Jalur Tulis (Fase 1)

```
call(task_upsert)
  -> validate schema + enum + PIC/deadline
  -> refuse if tab.kind == "Arsip"
  -> approval prompt (operator)
  -> clear block -> values update (RAW, padded)
  -> read-back exact cells
  -> update Rev. row
  -> append revision note
  -> audit log
  -> return before/after
```

Aturan turunan (dari `planning-trix-revisions.md`): perubahan satu baris wajib
ikut memperbarui subtotal → total → buffer → gap → baris skenario → catatan.
Server menolak tulis kalau angka turunan tidak ikut disertakan.

## 7. Error Handling

| Kondisi | Perilaku |
| --- | --- |
| Tool error `gws` | Kembalikan `{ok:false, error:{code:"GWS_ERROR", message}}` |
| Parse gagal | `E_PARSE`, sertakan potongan output mentah terbatas |
| Tab tidak ada | `E_TAB_NOT_FOUND`, sertakan daftar tab mirip |
| Kolom tidak cocok header | `E_SCHEMA_MISMATCH`, tunjukkan header aktual |
| Nilai di luar enum | Field `unknown` + `warning`, bukan error fatal |
| Konflik angka | `meta.conflicts[]`, `ok` tetap true |
| Tulis ditolak | `E_VALIDATION`, sebutkan aturan yang gagal |

## 8. Keamanan

- Tidak ada token di config/repo. Semua akses lewat OAuth `gws` di host.
- Read-only default; tool tulis butuh mode eksplisit + approval.
- Tab `(Arsip)` read-only.
- Data budget, sponsor, kontak eksternal: internal, jangan keluar group.
- Audit log lokal, tidak boleh berisi rahasia.

## 9. Deployment & Konfigurasi

```bash
# registrasi (contoh, dijalankan saat implementasi)
openclaw mcp add planning-trix \
  --command node \
  --arg /home/farhan/.openclaw/workspace-devfest/tools/planning-trix-mcp/dist/index.js \
  --cwd /home/farhan/.openclaw/workspace-devfest/tools/planning-trix-mcp

openclaw mcp doctor planning-trix --probe
openclaw mcp tools planning-trix --include 'planning_index,budget_summary,...'
```

- Filter tool per-server: fase 0 hanya expose tool baca.
- Kalau host pindah mesin, `gws` + config MCP harus ada di mesin itu.

## 10. Struktur Repo (usulan)

```
docs/planning-trix-mcp/
  PRD.md
  SYSTEM-DESIGN.md
  registry.example.json
tools/planning-trix-mcp/        # implementasi (fase berikutnya)
  package.json
  src/index.js
  src/adapters/gws.js
  src/normalize/*.js
  src/registry/planning.json
  test/fixtures/*.json
  test/*.test.js
```

## 11. Rencana Tes

- Unit: normalizer (status, money, date, phone, bool) + registry loader.
- Kontrak: tiap tool diuji terhadap fixture `gws` (output nyata yang disimpan).
- Integrasi: 1 panggilan `batchGet` nyata per tool (read-only) + cek bentuk output.
- Negatif: tab arsip ditolak, kolom tidak cocok, error gws, nilai di luar enum.
- Probe: `openclaw mcp doctor planning-trix --probe` harus melaporkan tool lengkap.

## 12. Observability

- Log tiap tool call: nama, durasi, jumlah baris, warning/conflict.
- Tidak log isi sensitif penuh (kontak) kecuali mode debug.
- `meta.warnings[]` dan `meta.conflicts[]` jadi sinyal kualitas data.

## 13. Milestone Teknis

- M0: registry + adapter + normalizer + tes unit.
- M1: 8 tool baca + tes kontrak + `mcp add` + probe hijau.
- M2: 3 tool tulis + validator + audit + approval.
- M3: resource + sinkron memori.

## 14. Alternatif yang Dipertimbangkan

- **CLI `ptx` + skill** (tanpa MCP): lebih murah, cukup untuk 1 agent. Ditolak
  karena tujuan Kak Farhan adalah satu pintu untuk banyak klien dan tool typed.
- **Google Apps Script web app**: tanpa stdio, tapi menambah surface publik dan
  auth sendiri. Ditolak.
- **Cache penuh spreadsheet lokal**: cepat, tapi risiko stale tinggi. Ditunda;
  bisa ditambah di Fase 2 dengan TTL.