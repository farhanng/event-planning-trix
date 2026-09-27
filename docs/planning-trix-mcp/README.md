# Planning Trix MCP — dokumentasi

Folder ini berisi PRD dan system design untuk MCP server `planning-trix`,
pintu tunggal pengambilan data Planning Trix DevFest 2026.

Isi:

- `PRD.md` — masalah, tujuan, user story, ruang lingkup per fase, metrik, risiko.
- `SYSTEM-DESIGN.md` — arsitektur, registry, kontrak tool, jalur tulis, tes, deploy.
- `registry.example.json` — contoh bentuk registry tab → entitas → kolom.

Ringkas konteks: Planning Trix punya 56 tab, skema kolom beda-beda, 11 variasi
status, dan data 2025 masih bercampur di tab yang dianggap hidup. MCP ini
menggantikan pola "agent baca sel mentah" dengan tool domain yang mengembalikan
JSON ternormalisasi + ringkasan teks.

Fase:

1. Fase 0 (MVP) — 8 tool baca + `planning_index`, read-only.
2. Fase 1 — 3 tool tulis dengan validasi + approval + audit log.
3. Fase 2 — MCP resource + sinkronisasi terjadwal ke memori agent.

Dokumen terkait di root workspace: `planning-trix-standard.md` (standar
formatting + index 56 tab di tab `000 - Standar & Index`).

Status: Draft 0.1, 27 Sep 2026. Belum ada implementasi.