# event-planning-trix

Dokumen desain untuk **Planning Trix Data Gateway (MCP)** — server MCP yang
jadi pintu tunggal pengambilan data spreadsheet Planning Trix DevFest.

Tujuan: agent (dan klien MCP lain) memanggil tool domain seperti
`budget_summary`, `speaker_candidates`, `task_list`, bukan membaca sel mentah.
Output JSON terstruktur dengan field, tipe, dan enum status yang stabil.

## Isi

- `docs/planning-trix-mcp/README.md` — ringkasan
- `docs/planning-trix-mcp/PRD.md` — kebutuhan produk, ruang lingkup per fase, metrik, risiko
- `docs/planning-trix-mcp/SYSTEM-DESIGN.md` — arsitektur, registry, kontrak tool, jalur tulis, tes, deploy
- `docs/planning-trix-mcp/registry.example.json` — contoh pemetaan tab -> entitas -> kolom

## Status

Draft 0.1 (27 Sep 2026). Belum ada implementasi. Roadmap: Fase 0 read-only
(8 tool) -> Fase 1 tulis terbatas + audit -> Fase 2 resource + sinkronisasi.

## Catatan

Semua identifier internal (spreadsheet id, nomor telepon, data budget) sudah
diganti placeholder. Dokumen ini sengaja tidak memuat data event.
