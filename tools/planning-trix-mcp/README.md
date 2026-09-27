# planning-trix-mcp

Server MCP untuk akses terstruktur ke Planning Trix (GDG Cloud Bandung).
Agent memanggil tool domain (bukan baca sel mentah) dan menerima JSON
terstruktur + ringkasan teks siap kirim.

Status: **Fase 0 (read-only) — implementasi + tes lengkap, coverage 100%.**

## Prinsip

- Satu pintu: tool domain (`budget_summary`, `speaker_candidates`, ...), bukan baca sel.
- Enum & normalisasi terpusat: status/uang/tanggal/HP/boolean dari satu sumber.
- Registry JSON = otak pemetaan `tab -> entitas -> kolom`; id & kredensial dari env.
- Production read-only; tulis hanya dev + approval (Fase 1).
- Nilai tak terpetakan -> `unknown`; angka bentrok -> `meta.conflicts[]`.

## Struktur

```
src/
  config/env.js              # PTX_ENV, PTX_SPREADSHEET_ID_<ENV>, PTX_SA_KEY_FILE, PTX_REGISTRY
  domain/                    # normalizer + enum + aggregate + error (murni, tanpa I/O)
  infra/
    registry/registry.js     # muat & validasi registry, resolve event/tab
    sheets/client.js         # Google Sheets API v4 (service account)
  app/
    tools/index.js           # 11 tool baca + row mapper
    tools/rows.js            # mapping kolom -> field
    output/format.js         # envelope + ringkasan teks
    register.js              # validasi zod -> handler -> envelope
  server.js                  # registrasi tool ke McpServer
  index.js                   # entry stdio
registry/planning.json       # katalog event + pemetaan tab (contoh, id placeholder)
test/                        # unit + kontrak + entrypoint (80+ tes)
```

## Tool Fase 0 (11, semua read-only)

`event_catalog`, `planning_index`, `budget_summary`, `ticket_summary`,
`partnership_pipeline`, `speaker_candidates`, `task_list`, `organizer_list`,
`logistic_needs`, `agenda_zona`, `risk_register`.

Semua tool menerima `event` (slug) — tidak ada default "event terbaru".

## Env

| Variabel | Isi |
| --- | --- |
| `PTX_ENV` | `dev` (default) atau `prod` |
| `PTX_SPREADSHEET_ID_DEV` | spreadsheet id salinan dev |
| `PTX_SPREADSHEET_ID_PROD` | spreadsheet id production |
| `PTX_SA_KEY_FILE` | path kunci service account (di luar repo) |
| `PTX_REGISTRY` | path registry (default `registry/planning.json`) |

## Tes

```bash
npm install
npm test          # jalankan semua tes
npm run coverage   # gate: lines/functions/statements/branches harus 100%
```

## Deploy (stdio)

```bash
openclaw mcp add planning-trix --command node \
  --arg <path>/src/index.js \
  --env PTX_ENV=dev \
  --env PTX_SPREADSHEET_ID_DEV=<id> \
  --env PTX_SA_KEY_FILE=<path-di-luar-repo>
openclaw mcp doctor planning-trix --probe
```
