# Planning Trix MCP — dokumentasi

Desain untuk MCP server `planning-trix`: pintu tunggal pengambilan data
spreadsheet Planning Trix GDG Cloud Bandung, supaya agent (dan klien MCP lain)
memanggil tool domain dan menerima JSON terstruktur, bukan membaca sel mentah.

## Isi

- `PRD.md` — masalah, tujuan, user story, ruang lingkup per fase, aturan
  environment dev/prod, metrik, risiko, milestone.
- `SYSTEM-DESIGN.md` — arsitektur, keputusan desain, Sheets API v4 + service
  account, registry multi-event, kontrak tool, jalur tulis, error handling,
  struktur repo, tes, deploy.
- `DATA-MODEL.md` — hierarki event, ERD, entitas + atribut, enum kanonik,
  formula turunan, aturan kualitas, naming, rencana migrasi.
- `registry.example.json` — contoh katalog event + pemetaan tab → entitas → kolom.

## Keputusan desain kunci

1. Semua development di **salinan spreadsheet dev**; production read-only.
2. Akses lewat **Google Sheets API v4 + service account** (bukan CLI `gws`).
3. **Dimensi event** jadi kelas satu: `Portfolio → Event → Spreadsheet → Tab`.
   Satu event = satu folder Drive + satu Planning Trix; event lintas tahun =
   event berbeda. Setiap tool **wajib** menyebut `event`, tidak ada default.
4. Nama tab **straight-forward** untuk data hidup; label `(Arsip)`, `(Draft)`,
   `(Turunan)` hanya untuk yang memang bukan data hidup.
5. Angka turunan pakai **formula spreadsheet**, bukan diketik manual.
6. **Committee dan Volunteer satu entitas** (`ORGANIZER`) + tabel `ASSIGNMENT`,
   karena orangnya sama dan bisa mengisi beberapa role dalam satu event.
7. Spreadsheet **UI/UX friendly**: dropdown enum, conditional formatting, freeze,
   format uang/tanggal, index berisi hyperlink.
8. Struktur kode berlapis (domain/infra/app), clean code + best practice.

## Fase

1. Fase 0 (MVP) — 10 tool baca + `event_catalog` + `planning_index`, read-only.
2. Fase 1 — 4 tool tulis (dev-only) + validasi + approval + audit log.
3. Fase 2 — MCP resource + sinkronisasi terjadwal ke memori agent.
4. Fase 3 — cutover ke production lewat checklist.

## Katalog event (recon 27 Sep 2026)

| slug | Event | Tahun | Planning Trix |
| --- | --- | --- | --- |
| `devfest26` | DevFest Cloud Bandung | 2026 | 57 tab (aktif) |
| `cloudnext26` | Cloud Next Bandung | 2026 | 31 tab |
| `juaragcp26` | JuaraGCP | 2026 | 25 tab |
| `devfest25` | DevFest Cloud Bandung | 2025 | 41 tab |
| `roadshow25` | Cloud Roadshow | 2025 | Ada |
| `iwd25` | IWD / WTM | 2025 | Ada |
| `devfest24` | Cloud DevFest Bandung | 2024 | Tidak ada trix utuh |
| `master` | Master Data lintas event | — | 3 tab, read-only |
| `templates` | Templates resmi | — | Event Planner + Asset Inventory |

## Status

Draft 0.3, 27 Sep 2026. Belum ada implementasi.

Blocker operasional: salinan dev belum bisa dibuat penuh karena kuota Drive akun
pemegang OAuth penuh (16,32 GB / 16,1 GB); folder `DEV - Planning Trix (sandbox)`
sudah ada tapi kosong. Butuh kuota tambahan, shared drive, atau akun lain sebelum
Fase 0 bisa dieksekusi penuh.