# PRD — Planning Trix Data Gateway (MCP)

- Status: Draft
- Versi: 0.1
- Tanggal: 27 Sep 2026
- Owner: Kak Farhan
- Penulis: DevFest AI
- Target: MCP server `planning-trix` untuk DevFest 2026

---

## 1. Latar Belakang

Planning Trix (Google Sheets `<SPREADSHEET_ID>`)
adalah sumber kebenaran semua data persiapan DevFest 2026: budget, tiket,
sponsor, speaker, task, logistik, agenda, panitia.

Kondisi saat ini (hasil audit 27 Sep 2026):

- 56 tab, tanpa index. Tidak ada satu tempat yang menyatakan tab mana aktif.
- Skema kolom beda-beda per tab dan sebagian rusak (header 5 kolom tapi data
  ada di kolom G; kolom Status berisi angka `417`).
- 11 variasi status (`Not Started`, `Done`, `Completed`, `LUNAS`, `Aktif`,
  `In-Progress`, `On Progress`, `PROCESS`, `To do`, `Doing`, `TBC`).
- Tab kembar dan data 2025 masih bercampur di tab yang dianggap hidup.
- Angka yang sama muncul di beberapa tab (target peserta bentrok 3 tempat).

Dampak ke agent: setiap pengambilan data harus baca sel mentah, menebak tab,
menebak kolom, dan menyimpulkan sendiri arti nilai. Ini sumber error utama —
salah tab, salah kolom, atau memakai angka 2025. Feedback panitia: Planning
Trix "agak kacau", dan output agent ikut tidak konsisten.

## 2. Tujuan

1. Satu pintu pengambilan data Planning Trix: agent memanggil tool domain
   (`budget_summary`, `speaker_candidates`, dst.), bukan membaca sel mentah.
2. Output terstruktur dan stabil: nama field, tipe, dan enum status tetap,
   tidak berubah walau posisi kolom di sheet berubah.
3. Menghilangkan kelas error "salah tab / salah kolom / pakai data tahun lama".
4. Bisa dipakai banyak klien (agent devfest, Claude Code, Cursor, agent lain),
   bukan hanya satu prompt.

## 3. Non-Tujuan

- Bukan pengganti Google Sheets. Panitia tetap edit sheet manual.
- Bukan alat migrasi/refactor isi sheet (itu kerjaan terpisah, lihat
  `planning-trix-standard.md`).
- Bukan sistem otorisasi baru. Kredensial tetap OAuth `gws` yang sudah ada.
- Fase awal bukan untuk menulis (write) — read-only dulu.
- Bukan renderer UI. Output JSON + ringkasan teks, bukan dashboard.

## 4. Pengguna

| Pengguna | Kebutuhan |
| --- | --- |
| Agent devfest (WhatsApp) | Jawab pertanyaan panitia: budget, status speaker, task siapa yang telat |
| Agent/divisi lain | Ambil data terstruktur tanpa baca sheet |
| Developer (Claude Code / Cursor) | Tool typed untuk eksplor data event |
| Kak Farhan | Audit cepat: angka mana yang masih 2025, mana yang bentrok |

## 5. User Story

- Sebagai agent, saya panggil `budget_summary` dan dapat total belanja, buffer,
  gap, plus daftar baris, tanpa tahu nama tab.
- Sebagai agent, saya panggil `speaker_candidates{status:"Proses"}` dan dapat
  kandidat yang sedang dikontak, tanpa parsing catatan panjang.
- Sebagai agent, saya panggil `task_list{pic:"Harrits"}` dan dapat task + deadline
  + status enum, bukan string campur.
- Sebagai agent, saya panggil `planning_index` dan tahu tab mana Aktif/Arsip
  sebelum menulis.
- Sebagai developer, saya pakai tool yang sama dari klien MCP lain.

## 6. Ruang Lingkup per Fase

### Fase 0 — Read-only (MVP)

8 tool baca + index. Semua tool mengembalikan JSON terstruktur + ringkasan teks.

| Tool | Isi | Sumber tab |
| --- | --- | --- |
| `planning_index` | Daftar tab: status, pemilik, aksi | `000 - Standar & Index` |
| `budget_summary` | Baris anggaran, subtotal, buffer, gap, skenario | `Budget 2026 (Draft)`, `Budget 2026 - In Out`, `Tiket 2026 (Draft)` |
| `ticket_summary` | Tier, harga, pax, total | `Tiket 2026 (Draft)` |
| `sponsor_pipeline` | Paket, harga, potensi, target | `Paket Sponsor 2026 (Draft)`, `Target Partnership` |
| `speaker_candidates` | Kandidat + status kontak + PIC | `[LO] Speakers Candidate`, `REF - Speaker Candidate` |
| `task_list` | Task + PIC + deadline + status enum | `General Task`, `Task OBJ *` |
| `logistic_needs` | Kebutuhan logistik + vendor + harga | `LOGISTIC - NEEDS`, `LOGISTIC - VENDOR` |
| `agenda_zona` | Rundown per zona | `Timeline Acara 2026 (Draft)` |

### Fase 1 — Write terbatas

Tool tulis dengan validasi ketat + audit log:

- `task_upsert` — tambah/ubah task (wajib PIC + deadline + status enum).
- `speaker_status_update` — ubah status kontak kandidat.
- `budget_note_append` — tambah catatan revisi tanpa mengubah angka.
- Semua tool tulis punya approval prompt; read tetap auto.

Aturan tulis: tolak tab berlabel `(Arsip)`; wajib read-back; wajib update
`Rev.` di baris 2; tambah catatan `Revisi <tgl>: <apa> <lama> -> <baru>`.

### Fase 2 — Resource + sinkronisasi

- MCP resource: `planning://index`, `planning://budget`, `planning://speaker`.
- Sinkron terjadwal ke memori agent (ringkas angka kunci, deteksi konflik).

## 7. Kebutuhan Fungsional

1. `planning_index` menandai tiap tab: `Aktif | Referensi | Draft | Legacy |
   Duplikat | Arsip`.
2. Tool baca menolak tab `(Arsip)` kecuali dipanggil eksplisit.
3. Semua nilai uang dinormalkan jadi integer IDR.
4. Semua tanggal dinormalkan ke ISO `YYYY-MM-DD`, dengan `raw` disimpan.
5. Semua status tugas dipetakan ke enum kanonik (6 nilai); nilai asli
   disimpan di field `raw_status`.
6. Nilai yang tidak bisa dipetakan → `unknown`, bukan ditebak.
7. Setiap respons menyertakan: `source_tabs`, `rev`, `fetched_at`.
8. Deteksi konflik: kalau angka kunci muncul di >1 tab dengan nilai beda,
   kembalikan `conflicts[]` dan jangan pilih sendiri.
9. Ringkasan teks siap kirim (bahasa Indonesia, tanpa emoji) opsional via
   parameter `format:"text"`.

## 8. Kebutuhan Non-Fungsional

- Latensi p95 < 3 detik per tool call (batchGet satu panggilan per tool).
- Read-only default; tulis butuh approval eksplisit.
- Tidak ada rahasia di config: kredensial lewat OAuth `gws` di mesin host.
- Log audit tiap operasi tulis: waktu, tool, argumen, tab, range, sebelum/sesudah.
- Idempoten untuk read. Tulis idempoten lewat kunci `(tab, entity_id, field)`.
- Gagal aman: kalau parse `gws` gagal, kembalikan error terstruktur,
  jangan output setengah jadi.

## 9. Metrik Keberhasilan

- 0 kasus agent salah tab/kolom setelah Fase 0 (dibanding baseline manual).
- 100% output status dari enum kanonik.
- Semua tool Fase 0 punya tes dengan fixture sheet (happy path + error).
- Waktu agent menjawab pertanyaan budget turun (target: 1 tool call, bukan
  5-10 baca sel).

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Skema sheet berubah, registry tidak ikut | Tool baca kolom salah | Registry satu sumber, tes kontrak, `openclaw mcp doctor --probe` |
| Over-engineering: server besar untuk 1 agent | Maintenance mahal | MVP tipis (8 tool), hanya jalan kalau ada ≥2 klien |
| Kredensial OAuth bocor ke config | Keamanan | Pakai `gws` yang sudah ada; jangan simpan token di config |
| Tool tulis merusak data | Data trusted rusak | Fase 1 terpisah, validasi + approval + read-back + audit |
| Data sumber tetap kotor (2 nilai beda) | Output ambigu | Laporkan `conflicts[]`, jangan menebak |
| Tab arsip ikut tertulis | Data 2025 ketimpa | Tolak tulis tab `(Arsip)` di level tool |

## 11. Pertanyaan Terbuka

1. Target peserta final 400 atau 500? (nempel di judul budget + tiket)
2. Registry diambil otomatis dari tab `000 - Standar & Index`, atau file
   manual di repo? (usulan: file manual di repo, divalidasi terhadap sheet)
3. Rename tab legacy ke `(Arsip)` kapan? MCP Fase 0 tidak butuh, Fase 1 butuh.
4. Apakah MCP ini juga dipakai agent lain (mis. agent personal Kak Farhan)?
5. Format ringkasan WA: template tetap atau bebas per tool?

## 12. Milestone

| Fase | Isi | Estimasi |
| --- | --- | --- |
| P0 | Registry + 8 tool baca + tes + `mcp add` + probe | 2-3 hari kerja |
| P1 | 3 tool tulis + validasi + audit log | 3-4 hari kerja |
| P2 | Resource + sinkron ke memori | 2 hari kerja |

## 13. Out of Scope

- Migrasi/normalisasi isi sheet (dokumen terpisah).
- Autentikasi baru di luar OAuth `gws`.
- UI/dashboard.
- Integrasi langsung ke Bevy, Goers, atau sistem eksternal lain.