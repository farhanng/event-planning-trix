# PRD — Planning Trix Data Gateway (MCP)

- Status: Draft 0.4
- Versi: 0.4 (revisi dari 0.3)
- Tanggal: 27 Sep 2026

Perubahan 0.4 (keputusan Kak Farhan 27 Sep 2026, 23:15):

1. **Production dibangun ulang sebagai file baru**, bukan bersih-bersih file
   lama. File 2026 sekarang tetap jadi sumber data 2026; data hidup dimigrasikan
   ke prod baru saat cutover. Salinan dev = sandbox uji skema baru.
2. **Target peserta final = 500.** Angka selaras di judul Budget/Tiket; label
   `Overview` yang "400 (TBC)" ikut disesuaikan saat dev.
3. **Salinan dev sudah dibuat**: `[DEV] Planning Trix - DevFest Cloud Bandung
   2026 (sandbox)` di folder `DEV - Planning Trix (sandbox)`.
4. **Service account khusus `planning-trix`** (bukan SA yang sudah ada).
5. **Rename/pindah tab legacy: setelah dev stabil**, ikut cutover plan.
6. **Event lama (2024, IWD, Roadshow, JuaraGCP): katalog saja**, tanpa registry
   tab; modul penuh hanya DevFest 2026.
7. Ringkasan WA: belum diputuskan (lihat bagian 14).
- Owner: Kak Farhan
- Penulis: DevFest AI
- Target: MCP server `planning-trix`

Perubahan 0.3 (feedback Kak Farhan 27 Sep 2026):

1. **Dimensi event ditambah.** Planning Trix ditulis per event di folder Drive
   sendiri, jadi hierarki resmi `Portfolio → Event → Spreadsheet → Tab`. Event
   lintas tahun = event berbeda, bukan kolom tahun.
2. **Committee + Volunteer disatukan** jadi entitas `ORGANIZER` + tabel
   `ASSIGNMENT` (orang yang sama bisa isi beberapa role di event).
3. ERD diperluas 17 → 58 entitas, hasil recon 4 Planning Trix lain + Templates +
   Master Data; entitas baru antara lain `PAYMENT`, `PURCHASE_ORDER`,
   `PARTICIPANT`, `REGISTRATION`, `SESSION`, `RISK`, `COMPANY`,
   `PARTNERSHIP_DEAL`.
4. Tool MCP **wajib** menyebut `event`; tidak ada default "event terbaru".

Perubahan 0.2 (feedback Kak Farhan 27 Sep 2026):

1. Semua development di **salinan spreadsheet**, production tidak disentuh.
2. Akses data lewat **Google Sheets API v4 + service account**, `gws` CLI dibuang.
3. **Nama tab straight-forward**, tanpa embel `Draft` / `2026`.
4. Pakai **formula spreadsheet** sebisa mungkin (angka turunan dihitung sheet).
5. **UI/UX spreadsheet** dirapikan (dropdown, warna, freeze, format).
6. Tambah **ERD + data plan**, ikuti clean code + best practice.

---

## 1. Latar Belakang

Planning Trix adalah sumber kebenaran data persiapan event GDG Cloud Bandung,
satu file per event. Hasil audit file DevFest 2026 (27 Sep 2026), dibandingkan
file lain (DevFest 2025, Cloud Next 2026, JuaraGCP 2026, Cloud Roadshow,
Templates, Master Data):

- File 2026: 57 tab tanpa index yang benar; tidak ada penanda tab mana aktif.
- Tidak ada dimensi event di dalam data; **25+ tab isi 2025 masih menempel** di
  file 2026 dan tidak bisa dibedakan dari data hidup tanpa baca sel satu-satu.
- Skema kolom beda-beda antar file maupun antar tab; sebagian rusak (header 5
  kolom, data nyasar ke kolom G).
- 11 variasi status (`Not Started`, `Done`, `Completed`, `LUNAS`, `Aktif`,
  `In-Progress`, `On Progress`, `PROCESS`, `To do`, `Doing`, `TBC`).
- Angka sama muncul di beberapa tab dengan nilai berbeda (target peserta 3 versi).
- Satu orang punya dua record (`Commitee` 37 nama tanpa nomor vs `Final New
  Volunteer` 33 nama dengan nomor); dedup manual terus-menerus.
- Pembayaran (DP/remaining/due date) cuma kolom, bukan data yang bisa ditanya.

Dampak: agent harus baca sel mentah, menebak file/tab/kolom, dan menyimpulkan
arti nilai. Ini sumber error utama, dan output jadi tidak konsisten.

## 2. Tujuan

1. Satu pintu pengambilan data: tool domain (`budget_summary`, dst.), bukan baca sel.
2. Output terstruktur: field, tipe, enum status stabil walau kolom di sheet bergeser.
3. Hilangkan kelas error "salah event / salah tab / salah kolom / pakai data tahun lama".
4. Satu sumber kebenaran per entitas; angka turunan dihitung formula, bukan
   diketik manual di banyak tempat.
5. Satu orang satu record: committee dan volunteer jadi satu `ORGANIZER`,
   perbedaan peran diselesaikan lewat `ASSIGNMENT`.
6. Spreadsheet yang bisa dibaca manusia tanpa panduan: layout rapi, warna
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
- Spreadsheet id tidak pernah di-hardcode: datang dari config per event
  (`PTX_SPREADSHEET_ID_<EVENT>`), di-resolve lewat katalog event di registry.
  Default runtime = dev.
- Akses levat **service account** yang di-share ke spreadsheet dev (Editor) dan
  production (Viewer). Kunci SA disimpan sebagai secret, tidak masuk repo.
- Cutover dev → prod hanya setelah checklist verifikasi (bagian 12).

Catatan status 27 Sep 2026 (rev 0.4): salinan dev sudah dibuat —
`[DEV] Planning Trix - DevFest Cloud Bandung 2026 (sandbox)`,
spreadsheet id `<SPREADSHEET_ID_DEV>`, 57 tab, owner
<OWNER_EMAIL>, folder `DEV - Planning Trix (sandbox)`
(`<FOLDER_DEV_SANDBOX>`). Kuota Drive sudah lega (4,23 GB dari
15 GB), blocker kuota beres. Blocker berikutnya: pembuatan service account
khusus `planning-trix`; gcloud di host login sebagai SA tanpa izin
`iam.serviceAccounts.create`, jadi SA dibuat lewat console atau dengan
kredensial OAuth pemilik project.

## 5. Pengguna

| Pengguna | Kebutuhan |
| --- | --- |
| Agent devfest (WhatsApp) | Jawab budget, status speaker, task telat |
| Agent/divisi lain | Data terstruktur tanpa baca sheet |
| Developer (Claude Code/Cursor) | Tool typed untuk eksplor data |
| Kak Farhan | Audit cepat: event mana, data mana yang bentrok |

## 6. User Story

- Panggil `event_catalog` → daftar event + folder + file trix-nya.
- Panggil `budget_summary{event:"devfest26"}` → total belanja, buffer, gap, baris,
  tanpa tahu nama tab.
- Panggil `speaker_candidates{event:"devfest26", status:"Proses"}` → kandidat
  yang sedang dikontak.
- Panggil `organizer_list{event:"devfest26", position:"LO"}` → siapa saja yang
  pegang posisi LO, lengkap dengan divisi dan nomor HP-nya.
- Panggil `task_list{event:"devfest26", pic:"..."}` → task + deadline + status enum.
- Panggil `planning_index{event:"devfest26"}` → tahu tab Aktif/Arsip sebelum menulis.
- Developer pakai tool yang sama dari klien MCP lain.

## 7. Ruang Lingkup per Fase

### Fase 0 — Read-only (MVP)

11 tool baca + index; semua mengembalikan JSON + ringkasan teks, dan semua
menerima `event` sebagai parameter wajib.

| Tool | Isi | Entitas sumber |
| --- | --- | --- |
| `event_catalog` | Daftar event, folder, file | EVENT, PORTFOLIO |
| `planning_index` | Daftar tab: kind, pemilik, aksi | EVENT_TAB |
| `budget_summary` | Baris, subtotal, buffer, gap, skenario | BUDGET_LINE, BUDGET_SUMMARY |
| `ticket_summary` | Tier, harga, pax, total | TICKET_TIER |
| `partnership_pipeline` | Paket, harga, potensi, deal | SPONSOR_PACKAGE, PARTNERSHIP_DEAL, COMPANY |
| `speaker_candidates` | Kandidat + status kontak + PIC | SPEAKER, SPEAKER_PIPELINE, SPEAKER_REFERENCE |
| `task_list` | Task + PIC + deadline + status | TASK |
| `organizer_list` | Orang + penugasan (committee/volunteer) | ORGANIZER, ASSIGNMENT, DIVISION |
| `logistic_needs` | Kebutuhan + order + vendor + pembayaran | LOGISTIC_NEED, PURCHASE_ORDER, VENDOR, PAYMENT |
| `agenda_zona` | Rundown per zona | AGENDA_BLOCK, SESSION, ZONA |
| `risk_register` | Risiko + skor + mitigasi | RISK |

### Fase 1 — Write terbatas (dev dulu)

- `task_upsert`, `speaker_status_update`, `organizer_assign`, `budget_note_append`.
- Hanya ke environment dev sampai cutover disetujui.
- Approval prompt untuk tulis; read auto.
- Tulis ke event/tab bertipe `Arsip` atau `Draft` selalu ditolak.

### Fase 2 — Resource + sinkronisasi

- MCP resource: `planning://events`, `planning://<event>/index`,
  `planning://<event>/budget`, `planning://<event>/speaker`.
- Sinkron terjadwal ke memori agent; deteksi konflik lintas tab.

## 8. Kebutuhan Fungsional

1. `planning_index` menandai tab: `Aktif | Referensi | Arsip | Draft | Turunan`.
2. Tool baca menolak tab arsip kecuali diminta eksplisit.
3. Tool wajib menerima `event`; slug tak dikenal → `E_EVENT_UNKNOWN`.
4. Uang → integer IDR; tanggal → ISO `YYYY-MM-DD` (+ `raw`); status → enum kanonik
   (+ `raw_status`).
5. Nilai yang tak terpetakan → `unknown`, bukan ditebak.
6. Respons menyertakan `event`, `source_tabs`, `rev`, `fetched_at`.
7. Angka kunci beda antar tab → `conflicts[]`, jangan pilih sendiri.
8. Angka turunan (subtotal/total/gap) dihitung formula di sheet; tool hanya membaca.
9. Ringkasan teks bahasa Indonesia opsional (`format:"text"`).

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

1. **Nama tab** straight-forward untuk data hidup: kata benda biasa, tanpa
   `Draft`/`2026`. Label arsip/draft/turunan hanya untuk yang memang bukan data
   hidup: `<Nama> (Arsip <tahun>)`, `<Nama> (Draft)`, `<Nama> (Turunan <sumber>)`.
2. **Header block** 3 baris: judul + nama event + owner; rev + status data +
   sumber; kosong.
3. **Status** dari satu enum; diinput lewat dropdown (data validation).
4. **Formula** untuk semua angka turunan (SUM/SUMIF/ARRAYFORMULA); sel formula
   dibedakan warna dari sel input.
5. **UX**: freeze header, format mata uang/tanggal, conditional formatting
   (telat/status), warna tab per divisi, index tab berisi link ke tiap tab.
6. Satu fakta satu tempat; kolom PIC + Deadline wajib (`TBD` kalau belum ada).
7. Satu orang satu record: tidak ada tabel orang kedua; peran diisi lewat
   penugasan.

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

## 14. Keputusan (eks Pertanyaan Terbuka)

Diputuskan Kak Farhan 27 Sep 2026, 23:15:

1. **Target peserta final = 500** (label `Overview` yang "400 (TBC)" ikut
   disesuaikan saat dev).
2. **Salinan dev sudah dibuat** di folder `DEV - Planning Trix (sandbox)`.
3. **Service account khusus `planning-trix`** dibuat (bukan SA lama).
4. **Rename/pindah tab legacy production: setelah dev stabil**, ikut cutover plan.
5. **Production dibangun ulang sebagai file baru** (bukan bersih-bersih file
   2026). Data hidup dimigrasikan ke prod baru saat cutover; data 2025 di file
   2026 tidak dipindah manual.
6. **Event lama (DevFest 2024, IWD, Roadshow, JuaraGCP): katalog saja**, tanpa
   registry tab. Modul penuh hanya DevFest 2026.
7. **Format ringkasan WA: template tetap** — ringkasan teks dari tool MCP
   (mis. `budget_summary`) dipakai konsisten supaya mudah dibaca panitia dan
   tidak berubah-ubah tiap jawaban.

## 15. Milestone

| Fase | Isi | Estimasi |
| --- | --- | --- |
| P0 | Salinan dev + katalog event + registry + 11 tool baca + tes + probe | 4-5 hari kerja |
| P1 | 4 tool tulis + validasi + audit (dev) | 3-4 hari kerja |
| P2 | Resource + sinkron memori | 2 hari kerja |
| P3 | Cutover prod + migrasi enum/formula + normalisasi ORGANIZER | 3 hari kerja |

## 16. Out of Scope

- Bersih-bersih file production lama (yang lama dibiarkan apa adanya;
  production baru dibangun dari standar).
- Migrasi/normalisasi production sebelum dev stabil.
- Autentikasi baru selain service account.
- UI/dashboard.
- Integrasi Bevy/Goers/sistem eksternal lain.
- Keputusan desain ulang struktur folder Drive panitia (tool hanya membaca).