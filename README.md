# Mini Task Manager

Aplikasi sederhana untuk mengelola task internal: membuat task, memindahkan status
mengikuti alur yang tetap, dan melihat riwayat perubahan (audit log) per task:
siapa, dari status apa ke status apa, dan kapan.

- **Frontend:** React 19 + TypeScript (Vite)
- **Backend:** Node.js + Express 5 + TypeScript
- **Database:** SQLite (better-sqlite3), satu file, dibuat otomatis

## Cara menjalankan

Butuh **Node.js 22.12+** (lihat `.nvmrc`) dan npm 10+.

```bash
npm install
npm run dev
```

- Buka **http://localhost:5173**
- Backend API berjalan di http://localhost:3001. Vite meneruskan `/api` ke sana, jadi tidak perlu setup CORS.
- Data disimpan di `backend/data/tasks.db`. Untuk reset, hapus file itu.

Menjalankan terpisah, test, dan typecheck:

```bash
npm run dev -w backend     # API saja
npm run dev -w frontend    # UI saja
npm test                   # 24 test (shared + backend)
npm run typecheck          # ketiga package
```

Variabel opsional: `API_PORT` (default 3001) dan `DB_FILE` untuk backend, `API_URL` untuk target proxy frontend.

Contoh lewat curl:

```bash
curl -X POST localhost:3001/api/tasks -H 'Content-Type: application/json' -H 'X-Actor: john.doe' -d '{"title":"Prepare Invoice"}'
curl -X PUT localhost:3001/api/tasks/1/status -H 'Content-Type: application/json' -H 'X-Actor: jane.smith' -d '{"status":"pending"}'
curl localhost:3001/api/tasks/1/audit-logs
```

## Arsitektur

```
shared/                 tipe domain + aturan alur status, dipakai frontend DAN backend
backend/src/
  db/database.ts        schema SQLite, trigger append-only, CHECK constraint
  repositories/         akses SQL; audit log hanya punya append() dan listByTask()
  services/             TaskService: aturan bisnis, setiap perubahan = satu transaksi
  http/                 actor (header X-Actor), validasi (zod), error handler
  routes/tasks.ts       route tipis: parse request → panggil service → kirim response
backend/test/           test API end-to-end (supertest) dengan database in-memory
frontend/src/
  api.ts                klien API bertipe (memakai tipe dari shared)
  App.tsx               state, dan ambil ulang data setelah setiap perubahan
  components/           TaskItem, StatusSteps, AuditLogList, CreateTaskForm, ActorSelect
```

Alur sebuah request: `route` → `requireActor` + validasi zod → `TaskService` (transaksi) → `repositories` → SQLite.

**Konsistensi frontend–backend.** Daftar status, urutan alurnya, tipe `Task` / `AuditLog`, dan
format error didefinisikan sekali di `shared/`. Backend memakainya untuk validasi (dan untuk
`CHECK` di database), frontend memakainya untuk menentukan tombol "Move to …" berikutnya.
Kalau alur status diubah, kedua sisi ikut berubah, dan TypeScript menandai bagian yang perlu disesuaikan.

### API

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/users` | – | `User[]` (daftar user hardcoded) |
| GET | `/api/tasks` | – | `Task[]`, terbaru dulu, tanpa yang sudah dihapus |
| POST | `/api/tasks` | `{ title, description? }` | `201 Task` |
| PUT | `/api/tasks/:id/status` | `{ status }` | `200 { task, changed }` |
| DELETE | `/api/tasks/:id` | – | `204` |
| GET | `/api/tasks/:id/audit-logs` | – | `AuditLog[]`, terlama dulu |

Setiap request yang mengubah data wajib membawa header `X-Actor: <username>`.
Error selalu berbentuk `{ "error": { "code", "message", "details?" } }`:
`400 VALIDATION_ERROR` / `UNKNOWN_ACTOR`, `404 TASK_NOT_FOUND`, `409 INVALID_TRANSITION`.

### Data

- **Task:** `id, title, description, status, createdAt, updatedAt` (+ `deleted_at` di database)
- **AuditLog:** `id, taskId, taskTitle, actor, action, fromStatus, toStatus, createdAt`
  - `action`: `task_created` (from `null` → `to_do`), `status_changed`, `task_deleted` (from status terakhir → `null`)
  - Diurutkan berdasarkan `id` (AUTOINCREMENT, tidak pernah dipakai ulang), sehingga urutan kronologis tetap benar walau dua entri punya timestamp yang sama.

Di UI, satu entri tampil seperti contoh di brief:
`2025-01-01 10:00:00 · User "john.doe" changed Task "Prepare Invoice" status from "pending" to "in_progress"`.

## Asumsi

1. **Alur status hanya maju satu langkah:** `to_do → pending → in_progress → done`. Tidak boleh melompat
   (`to_do → done`), tidak boleh mundur, dan `done` adalah status akhir. Task baru selalu dimulai dari `to_do`.
2. **Update ke status yang sama itu sukses, bukan error:** `200` dengan `changed: false`, tanpa audit log
   baru. Begitulah saya mengartikan "idempotent".
3. **Delete = soft delete.** Audit log tidak boleh dihapus "dalam keadaan apapun", jadi log harus tetap
   menunjuk ke task yang masih ada. Task yang dihapus hilang dari list, tapi riwayatnya tetap bisa dibaca
   lewat `GET /api/tasks/:id/audit-logs`.
4. **Create dan delete juga dicatat** di audit log, bukan hanya perubahan status, karena masalah utamanya
   adalah "tidak jelas siapa mengubah apa".
5. **Actor** berasal dari daftar user hardcoded (`backend/src/users.ts`), dipilih lewat dropdown "Acting as",
   dan dikirim di header `X-Actor`. Backend menolak actor yang tidak ada di daftar. Tidak ada auth, sesuai brief.
6. **Waktu** disimpan dalam UTC (ISO 8601) dan ditampilkan dalam zona waktu browser.
7. **Field task:** title wajib (maks. 200 karakter), description opsional (maks. 2000). Title tidak bisa
   diedit karena tidak diminta. Log tetap menyimpan snapshot title supaya setiap entri bisa dibaca berdiri sendiri.

## Trade-off

- **SQLite, bukan in-memory atau JSON.** Saya mendapat transaksi sungguhan, trigger, dan constraint, sehingga
  "status dan log selalu sinkron" serta "log tidak bisa diubah" dijamin oleh database, bukan hanya oleh kode.
  Biayanya: dependency native (better-sqlite3), satu file, dan satu penulis dalam satu waktu.
- **Status disimpan di task dan log ditulis dalam transaksi yang sama**, bukan event sourcing (status
  diturunkan dari log). Event sourcing membuat sinkron otomatis, tetapi setiap pembacaan jadi lebih mahal
  dan kodenya lebih rumit untuk skala sekecil ini.
- **`PUT` berisi status tujuan, bukan endpoint "advance".** Dengan begitu idempotensi muncul dengan
  sendirinya: klik ganda atau dua user yang menekan tombol yang sama hanya menghasilkan satu log. Biayanya,
  klien harus tahu status berikutnya, dan ini terbantu oleh package `shared`.
- **Actor lewat header**, bukan di body. Actor adalah identitas pemanggil, bukan data task. Nanti
  bisa diganti auth sungguhan dengan hanya mengubah `http/actor.ts`.
- **Package `shared` dipakai langsung sebagai TypeScript**, tanpa build step, dan backend dijalankan
  dengan `tsx`. Ini sederhana untuk take-home. Untuk produksi, backend sebaiknya dikompilasi ke JavaScript.
- **Frontend mengambil ulang seluruh list setelah setiap perubahan**, baik berhasil maupun gagal. Cara ini
  sederhana dan selalu menampilkan kondisi server (misalnya setelah user lain mengubah task yang sama), tetapi
  tidak efisien untuk data besar dan tidak ada update live antar user.
- **Validasi frontend minimal:** UI hanya menawarkan langkah berikutnya, dan backend tetap menjadi sumber kebenaran.
- **Tidak ada test frontend.** Test difokuskan ke aturan backend yang paling penting. UI dicek manual di browser.

## Jika ada waktu lebih

- Auth sungguhan, supaya actor berasal dari session/token, bukan dari pilihan dropdown.
- Halaman activity feed global (termasuk task yang sudah dihapus) dengan filter per user.
- Optimistic concurrency eksplisit (`version` / `ETag` + `If-Match`), supaya klien tahu persis kalau datanya sudah basi.
- Update live antar user (SSE/WebSocket).
- Pagination untuk task dan audit log.
- Migrasi schema yang punya versi, bukan `CREATE TABLE IF NOT EXISTS`.
- Test komponen (React Testing Library) dan e2e (Playwright).
- Hash chain di audit log, supaya perubahan langsung di file database bisa terdeteksi.

## Pertanyaan

### Bagaimana kamu memastikan audit log tidak ter-modifikasi?

Lewat beberapa lapisan, dari yang paling luar:

1. **API:** tidak ada route untuk mengubah atau menghapus log. `PUT/PATCH/DELETE /api/tasks/:id/audit-logs` mengembalikan 404.
2. **Kode:** `AuditLogRepository` hanya punya `append()` dan `listByTask()`.
3. **Database:** trigger `BEFORE UPDATE` dan `BEFORE DELETE` pada `audit_logs` selalu `RAISE(ABORT)`,
   termasuk untuk SQL yang dijalankan langsung ke database. `CHECK` menolak entri yang tidak valid
   (misalnya from = to). Foreign key `ON DELETE RESTRICT` membuat task tidak bisa di-hard-delete, sehingga
   delete selalu berupa soft delete dan log tidak pernah kehilangan task-nya.
4. **Konsistensi:** perubahan status dan penulisan log terjadi dalam satu transaksi. Kalau log gagal
   ditulis, perubahan status ikut dibatalkan (ada test-nya).

Semua poin di atas dicek oleh test di `backend/test/tasks.test.ts`.
Batasnya: orang yang punya akses langsung ke file database bisa menghapus trigger. Untuk itu dibutuhkan
tamper-evidence (hash chain) dan, di database server seperti Postgres, user aplikasi yang hanya punya
hak `INSERT` dan `SELECT` pada tabel log.

### Bagian mana yang paling berisiko jika digunakan oleh banyak user?

- **Identitas actor tidak diverifikasi.** Siapa pun bisa memilih "john.doe" di dropdown. Audit log hanya
  sebaik identitas yang dicatatnya, jadi ini risiko terbesar terhadap kepercayaan pada log.
- **Penyimpanan satu file, satu penulis.** SQLite mengantrekan semua write, dan better-sqlite3 bersifat
  sinkron, sehingga query lambat memblokir event loop. Aplikasi juga tidak bisa dijalankan di beberapa
  server sekaligus.
- **Perubahan bersamaan pada task yang sama** sudah ditangani: transaksi `BEGIN IMMEDIATE` (lock tulis
  diambil sebelum membaca), update compare-and-set (`WHERE status = <status lama>`), dan target status di
  `PUT`. Hasilnya, request ganda menjadi no-op dan request dari data basi ditolak dengan 409. Tetapi UI
  tidak live, jadi user baru tahu datanya basi setelah mencoba.

### Jika task ini berkembang menjadi sistem besar, bagian mana yang akan kamu refactor terlebih dahulu dan kenapa?

**Lapisan data dan batas transaksinya.** Saya akan memindahkannya ke Postgres, membuat repository
menjadi async, dan menambahkan abstraksi unit-of-work/transaksi (`SELECT … FOR UPDATE` untuk lock baris).
Saya mulai dari sini karena hampir semua kebutuhan skala bergantung padanya: banyak instance, banyak user
yang menulis bersamaan, dan hak akses database untuk melindungi log. Karena SQL sudah terkumpul di
`repositories/`, aturan di `TaskService` hampir tidak berubah.

Setelah itu: identitas dari auth, lalu model audit yang lebih umum (event per field atau per aksi,
memakai definisi state machine) supaya perubahan lain, seperti title atau assignee, ikut tercatat tanpa
menambah `if` baru di service.

## Penggunaan AI

Solusi ini dibuat dengan bantuan **Claude Code** (AI coding agent): kode backend dan frontend, test,
dan draf README ini.

Cara memvalidasinya:

- **24 test otomatis** (vitest + supertest) untuk aturan yang paling penting: alur status, idempotensi,
  penolakan transisi yang melompat atau mundur, actor wajib dan harus dikenal, soft delete yang menyimpan
  riwayat, immutability log (termasuk lewat SQL langsung ke database), dan rollback ketika log gagal ditulis.
- **Typecheck strict** di ketiga package.
- **Dicoba manual di browser:** membuat task, memindahkan status dengan user yang berbeda, membuka riwayat,
  menghapus task, dan skenario data basi (status diubah lewat API oleh "user lain", lalu tombol di UI
  ditekan, hasilnya 409, pesan yang jelas, dan list ter-refresh). Juga dicek di lebar layar ponsel.
- **Dicek dengan curl:** riwayat task yang sudah dihapus tetap utuh, dan tidak ada route untuk menghapus log.

Saat dicoba langsung, ditemukan satu masalah yang tidak tertangkap oleh test: alat yang menjalankan frontend
dan backend bersamaan mengisi variabel `PORT` untuk frontend, sehingga backend ikut memakai port yang sama.
Backend sekarang membaca `API_PORT`.
