# PRD — Planning Trix Data Gateway (MCP)

- Status: Draft 0.2
- Versi: 0.2 (revisi dari 0.1)
- Tanggal: 27 Sep 2026
- Owner: Kak Farhan
- Penulis: DevFest AI
- Target: MCP server `planning-trix`

Perubahan 0.2 (feedback Kak Farhan 27 Sep 2026):

1. Semua development di **salinan spreadsheet**, production tidak disentuh.
2. Akses data lewat **Google Sheets API v4 + service account**, `gws` CLI dibuang.
3. **Nama tab straight-forward**, tanpa embel `Draft` / `2026`.
4. Pakai **formula spreadsheet** sebisa mungkin (angka turunan dihitung sheet).
5. **UI/UX spreadsheet** dirapikan (dropdown, warna, freeze, format).
6. Tambah **ERD + data plan**, ikuti clean code + best practice.

---

## 1. Latar Belakang

Planning Trix adalah sumber kebenaran data persiapan DevFest 2026. Hasil audit
27 Sep 2026:

- 56 tab tanpa index; tidak ada penanda tab mana aktif.
- Skema kolom beda-beda per tab; sebagian rusak (header 5 kolom, data di kolom G).
- 11 variasi status (`Not Started`, `Done`, `Completed`, `LUNAS`, `Aktif`,
  `In-Progress`, `On Progress`, `PROCESS`, `To do`, `Doing`, `TBC`).
- Tab kembar + data 2025 bercampur di tab yang dianggap hidup.
- Angka sama muncul di beberapa tab dengan nilai berbeda (target peserta 3 versi).

Dampak: agent harus baca sel mentah, menebak tab/kolom, dan menyimpulkan arti
nilai. Ini sumber error utama, dan output jadi tidak konsisten.

## 2. Tujuan

1. Satu pintu pengambilan data: tool domain (`budget_summary`, dst.), bukan baca sel.
2. Output terstruktur: field, tipe, enum status stabil walau kolom di sheet bergeser.
3. Hilangkan kelas error "salah tab / salah kolom / pakai angka tahun lama".
4. Satu sumber kebenaran per entitas; angka turunan dihitung formula, bukan
   diketik manual di banyak tempat.
5. Spreadsheet yang bisa dibaca manusia tanpa panduan: layout rapi, warna
   konsisten, dropdown status, format uang/tanggal.

## 3. Non-Tujuan

- Bukan pengganti Google Sheets untuk input manual panitia.
- Bukan alat otorisasi baru; kredensial pakai service account.
- Fase awal read-only.
- Bukan UI/dashboard.

## 4. Environment & Keamanan Lingkungan

Aturan wajib (feedback Kak Farhan):

- **Production** = spreadsheet asli milik panitia. **Read-only** untuk tooling.
  Tidak ada operasi tulis, rename, atau re-format di production.
- **Development** = salinan spreadsheet di folder Drive terpisah. Semua
  perubahan skema, rename tab, formula, enum, dan uji coba tulis terjadi di sini.
- Spreadsheet id tidak pernah di-hardcode: datang dari config per environment
  (`SPREADSHEET_ID_DEV`, `SPREADSHEET_ID_PROD`). Default runtime = dev.
- Akses levat **service account** yang di-share ke spreadsheet dev (Editor) dan
  production (Viewer). Kunci SA disimpan sebagai secret, tidak masuk repo.
- Cutover dev → prod hanya setelah checklist verifikasi (bagian 12).

Catatan status 27 Sep 2026: pembuatan salinan dev **tertunda** karena kuota
Drive akun pemegang OAuth penuh (usage 16,32 GB dari limit 16,1 GB). Ini blocker
operasional, bukan blocker desain; lihat bagian 13.

## 5. Pengguna

| Pengguna | Kebutuhan |
| --- | --- |
| Agent devfest (WhatsApp) | Jawab budget, status speaker, task telat |
| Agent/divisi lain | Data terstruktur tanpa baca sheet |
| Developer (Claude Code/Cursor) | Tool typed untuk eksplor data |
| Kak Farhan | Audit cepat: angka mana 2025, mana bentrok |

## 6. User Story

- Panggil `budget_summary` → total belanja, buffer, gap, baris, tanpa tahu nama tab.
- Panggil `speaker_candidates{status:"Proses"}` → kandidat yang sedang dikontak.
- Panggil `task_list{pic:"..."}` → task + deadline + status enum.
- Panggil `planning_index` → tahu tab Aktif/Arsip sebelum menulis.
- Developer pakai tool yang sama dari klien MCP lain.

## 7. Ruang Lingkup per Fase

### Fase 0 — Read-only (MVP)

8 tool baca + index; semua mengembalikan JSON + ringkasan teks.

| Tool | Isi | Entitas sumber |
| --- | --- | --- |
| `planning_index` | Daftar tab: status, pemilik, aksi | Index |
| `budget_summary` | Baris, subtotal, buffer, gap, skenario | BudgetLine, BudgetSummary |
| `ticket_summary` | Tier, harga, pax, total | TicketTier |
| `sponsor_pipeline` | Paket, harga, potensi, prospek | SponsorPackage, SponsorProspect |
| `speaker_candidates` | Kandidat + status kontak + PIC | SpeakerCandidate, SpeakerReference |
| `task_list` | Task + PIC + deadline + status | Task |
| `logistic_needs` | Kebutuhan + vendor + harga | LogisticNeed, Vendor |
| `agenda_zona` | Rundown per zona | AgendaBlock |

### Fase 1 — Write terbatas (dev dulu)

- `task_upsert`, `speaker_status_update`, `budget_note_append`.
- Hanya ke environment dev sampai cutover disetujui.
- Approval prompt untuk tulis; read auto.

### Fase 2 — Resource + sinkronisasi

- MCP resource: `planning://index`, `planning://budget`, `planning://speaker`.
- Sinkron terjadwal ke memori agent; deteksi konflik.

## 8. Kebutuhan Fungsional

1. `planning_index` menandai tab: `Aktif | Referensi | Arsip`.
2. Tool baca menolak tab arsip kecuali diminta eksplisit.
3. Uang → integer IDR; tanggal → ISO `YYYY-MM-DD` (+ `raw`); status → enum kanonik
   (+ `raw_status`).
4. Nilai yang tak terpetakan → `unknown`, bukan ditebak.
5. Respons menyertakan `source_tabs`, `rev`, `fetched_at`.
6. Angka kunci beda antar tab → `conflicts[]`, jangan pilih sendiri.
7. Angka turunan (subtotal/total/gap) dihitung formula di sheet; tool hanya membaca.
8. Ringkasan teks bahasa Indonesia opsional (`format:"text"`).

## 9. Kebutuhan Non-Fungsional

- Latensi p95 < 3 dtk/tool (satu batchGet per tool).
- Read-only default; tulis butuh mode + approval.
- Secret tidak di repo; SA key lewat secret store/env.
- Audit log tiap tulis: ts, tool, args, tab, range, before/after.
- Read idempoten; tulis idempoten lewat kunci `(tab, entity_id, field)`.
- Gagal aman: `gws`/API error → error terstruktur, bukan output setengah jadi.
- Clean code: lapisan domain/infrastruktur terpisah, kontrak tervalidasi,
  normalizer murni (pure), tanpa id hardcode, konfigurasi dari env, tes unit +
  kontrak. Lihat `SYSTEM-DESIGN.md` bagian struktur & `DATA-MODEL.md`.

## 10. Standar Spreadsheet (produk)

1. **Nama tab** straight-forward: kata benda biasa, tanpa `Draft`/`2026`.
   Tahun hanya di tab arsip: `<Nama> (Arsip <tahun>)`.
2. **Header block** 3 baris: judul + owner; rev + status data + sumber; kosong.
3. **Status** dari satu enum; diinput lewat dropdown (data validation).
4. **Formula** untuk semua angka turunan (SUM/SUMIF/ARRAYFORMULA); sel formula
   dibedakan warna dari sel input.
5. **UX**: freeze header, format mata uang/tanggal, conditional formatting
   (telat/status), warna tab per divisi, index tab berisi link ke tiap tab.
6. Satu fakta satu tempat; kolom PIC + Deadline wajib (`TBD` kalau belum ada).

Detail lengkap: `DATA-MODEL.md`.

## 11. Metrik Keberhasilan

- 0 kasus agent salah tab/kolom di Fase 0.
- 100% status dari enum kanonik.
- Semua tool Fase 0 punya tes dengan fixture.
- Pertanyaan budget dijawab 1 tool call, bukan 5-10 baca sel.

## 12. Cutover Checklist (dev → prod)

1. Semua tool lolos tes kontrak di dev.
2. `planning_index` dev bersih: 0 tab legacy tanpa label.
3. Formula diverifikasi menghasilkan angka yang sama dengan angka manual 2026.
4. Enum status termigrasi; tidak ada nilai di luar enum.
5. Backup prod diambil sebelum perubahan apa pun.
6. Cutover dieksekusi setelah approval eksplisit Kak Farhan.

## 13. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Skema sheet berubah, registry tidak ikut | Baca kolom salah | Registry satu sumber + tes kontrak + `mcp doctor --probe` |
| Quota Drive penuh (status 27 Sep) | Tidak bisa buat salinan dev | Free up quota / shared drive / akun lain |
| SA key bocor | Akses data | Secret store, scope minimum, rotasi key |
| Tulis merusak data | Data rusak | Dev-only + validasi + approval + read-back + audit |
| Sumber masih kotor | Output ambigu | `conflicts[]`, jangan menebak |
| Formula rusak saat copy | Angka salah | Verifikasi angka dev vs prod sebelum cutover |

## 14. Pertanyaan Terbuka

1. Target peserta final 400 atau 500?
2. Salinan dev ditaruh di mana (butuh kuota Drive / shared drive)?
3. Service account: pakai yang sudah ada atau bikin SA khusus `planning-trix`?
4. Kapan rename tab production? (disarankan: setelah dev stabil + cutover plan)
5. Format ringkasan WA: template tetap atau bebas?

## 15. Milestone

| Fase | Isi | Estimasi |
| --- | --- | --- |
| P0 | Salinan dev + registry + 8 tool baca + tes + probe | 3-4 hari kerja |
| P1 | 3 tool tulis + validasi + audit (dev) | 3-4 hari kerja |
| P2 | Resource + sinkron memori | 2 hari kerja |
| P3 | Cutover prod + migrasi enum/formula | 2 hari kerja |

## 16. Out of Scope

- Migrasi/normalisasi production sebelum dev stabil.
- Autentikasi baru selain service account.
- UI/dashboard.
- Integrasi Bevy/Goers/sistem eksternal lain.