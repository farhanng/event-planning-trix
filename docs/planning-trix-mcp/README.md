# Planning Trix MCP — dokumentasi

Desain untuk MCP server `planning-trix`: pintu tunggal pengambilan data
spreadsheet Planning Trix DevFest, supaya agent (dan klien MCP lain) memanggil
tool domain dan menerima JSON terstruktur, bukan membaca sel mentah.

## Isi

- `PRD.md` — masalah, tujuan, user story, ruang lingkup per fase, aturan
  environment dev/prod, metrik, risiko, milestone.
- `SYSTEM-DESIGN.md` — arsitektur, keputusan desain, Sheets API v4 + service
  account, registry, kontrak tool, jalur tulis, error handling, struktur repo,
  tes, deploy.
- `DATA-MODEL.md` — ERD, entitas + atribut, enum kanonik, rencana formula
  spreadsheet, konvensi UX, naming, data quality rules, rencana migrasi.
- `registry.example.json` — contoh pemetaan tab -> entitas -> kolom.

## Keputusan desain kunci

1. Semua development di **salinan spreadsheet dev**; production read-only.
2. Akses lewat **Google Sheets API v4 + service account** (bukan CLI `gws`).
3. Nama tab **straight-forward**, tanpa embel `Draft`/`2026` (tahun hanya di arsip).
4. Angka turunan pakai **formula spreadsheet**, bukan diketik manual.
5. Spreadsheet **UI/UX friendly**: dropdown enum, conditional formatting,
   freeze, format uang/tanggal, index berisi hyperlink.
6. Struktur kode berlapis (domain/infra/app), clean code + best practice.

## Fase

1. Fase 0 (MVP) — 8 tool baca + `planning_index`, read-only, target dev.
2. Fase 1 — 3 tool tulis (dev-only) + validasi + approval + audit log.
3. Fase 2 — MCP resource + sinkronisasi terjadwal ke memori agent.
4. Fase 3 — cutover ke production lewat checklist.

## Status

Draft 0.2, 27 Sep 2026. Belum ada implementasi.

Blocker operasional: pembuatan salinan dev tertunda karena kuota Drive akun
pemegang OAuth penuh (16,32 GB / 16,1 GB). Butuh kuota tambahan, shared drive,
atau akun lain sebelum Fase 0 bisa dieksekusi penuh.