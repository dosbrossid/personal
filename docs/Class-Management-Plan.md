# Class Management Plan

> **Scope:** Modul manajemen kelas untuk dosen, terhubung ke Calendar, tanpa kompleksitas LMS penuh.
> **Status:** Planning ready for implementation
> **Owner persona:** Ziaul Maula, SE, M.Si — dosen FEB UNSAM

---

## 1. Tujuan Produk

`Class Management` dipakai untuk mengelola ritme mengajar per kelas secara ringan namun operasional. Fokusnya:

- membuat kelas baru per semester
- generate `8` atau `16` pertemuan secara otomatis
- menampilkan progress kelas
- mencatat materi/topik per pertemuan
- mencatat berapa kali memberi tugas
- menyimpan reflection note setelah mengajar
- terhubung langsung ke `Calendar`

Modul ini **bukan**:

- LMS
- sistem penugasan mahasiswa
- pengganti Google Classroom
- sistem nilai dan grading

---

## 2. Prinsip Produk

### 2.1 Ringan tapi bernilai

Kita hanya menyimpan data yang benar-benar membantu keputusan harian dosen:

- kelas apa yang akan datang
- pertemuan ke berapa sekarang
- apa materi yang sudah diajarkan
- sudah berapa kali memberi tugas
- apakah progress semester tertinggal

### 2.2 Calendar-first

Semua pertemuan kelas harus terlihat di kalender. User tidak boleh merasa `Class Management` dan `Calendar` adalah dua sistem terpisah.

### 2.3 Progress eksplisit

Setiap kelas wajib punya ringkasan cepat:

- `7 / 16 pertemuan`
- `3x tugas diberikan`
- `35 mahasiswa`
- `pertemuan berikutnya: Selasa 08:00`

### 2.4 Tidak masuk ke level mahasiswa individual dulu

Fase awal **tidak** mengelola:

- daftar mahasiswa satu per satu
- attendance per mahasiswa
- pengumpulan tugas
- nilai

Ini sengaja, supaya modul tetap ringan dan cepat dibangun.

---

## 3. Entity Model

## 3.1 `class_courses`

Satu record mewakili satu kelas dalam satu semester.

| Kolom | Tipe | Catatan |
|------|------|---------|
| `id` | `UUID PK` | default `gen_random_uuid()` |
| `user_id` | `UUID FK` | owner |
| `name` | `TEXT` | mis. `Pemasaran Digital A` |
| `course_code` | `TEXT` | mis. `MKT-302` |
| `semester_label` | `TEXT` | mis. `Genap 2026/2027` |
| `meeting_target` | `INT` | `8` atau `16` |
| `student_count` | `INT` | jumlah mahasiswa |
| `default_day_of_week` | `INT` | 0-6 |
| `default_start_time` | `TIME` | jam kelas |
| `default_end_time` | `TIME` | jam selesai |
| `location` | `TEXT` | ruang/zoom |
| `contextual_role` | `TEXT` | default `dosen` |
| `status` | `TEXT` | `active`, `completed`, `archived` |
| `notes` | `TEXT` | catatan umum kelas |
| `assignment_count` | `INT` | denormalized |
| `completed_meeting_count` | `INT` | denormalized |
| `created_at` | `TIMESTAMPTZ` | standar |
| `updated_at` | `TIMESTAMPTZ` | standar |
| `is_deleted` | `BOOLEAN` | soft delete |

### Constraint penting

- `meeting_target IN (8, 16)`
- `student_count >= 0`
- `completed_meeting_count <= meeting_target`

## 3.2 `class_sessions`

Satu record mewakili satu pertemuan.

| Kolom | Tipe | Catatan |
|------|------|---------|
| `id` | `UUID PK` | default `gen_random_uuid()` |
| `user_id` | `UUID FK` | owner, untuk RLS langsung |
| `class_course_id` | `UUID FK` | ke `class_courses.id` |
| `meeting_number` | `INT` | 1..8 atau 1..16 |
| `title` | `TEXT` | topik pertemuan |
| `description` | `TEXT` | deskripsi / materi |
| `session_date` | `DATE` | tanggal utama |
| `start_at` | `TIMESTAMPTZ` | sinkron ke calendar |
| `end_at` | `TIMESTAMPTZ` | sinkron ke calendar |
| `status` | `TEXT` | `planned`, `completed`, `canceled`, `rescheduled` |
| `attendance_count` | `INT` | attendance ringkas |
| `assignment_given` | `BOOLEAN` | ada tugas |
| `assignment_title` | `TEXT` | opsional |
| `assignment_due_at` | `TIMESTAMPTZ` | opsional |
| `reflection_note` | `TEXT` | catatan setelah kelas |
| `calendar_event_id` | `UUID FK` | ke `calendar_events.id`, nullable saat belum sync |
| `created_at` | `TIMESTAMPTZ` | standar |
| `updated_at` | `TIMESTAMPTZ` | standar |
| `is_deleted` | `BOOLEAN` | soft delete |

### Constraint penting

- unique `(class_course_id, meeting_number)`
- `meeting_number >= 1`
- `attendance_count >= 0`
- jika `assignment_given = false`, field assignment boleh null

---

## 4. Relasi ke Calendar

## 4.1 Prinsip source of truth

`class_sessions` adalah source of truth untuk pertemuan kelas. `calendar_events` hanyalah surface jadwal.

Jadi alurnya:

1. create/update/delete session
2. sinkronkan ke `calendar_events`
3. simpan `calendar_event_id` pada `class_sessions`

## 4.2 Kolom tambahan yang disarankan di `calendar_events`

Supaya event kelas bisa dikenali:

| Kolom | Tipe | Catatan |
|------|------|---------|
| `origin` | `TEXT` | `manual`, `ai`, `class_management`, `holiday` |
| `class_session_id` | `UUID nullable` | kalau event berasal dari kelas |

Kalau belum mau ubah schema `calendar_events`, minimal simpan linkage di `class_sessions.calendar_event_id` dan gunakan naming convention yang konsisten.

## 4.3 Aturan sinkronisasi

- Buat kelas baru -> generate semua `class_sessions` -> generate semua `calendar_events`
- Reschedule pertemuan -> update `calendar_events`
- Delete session -> soft delete session + soft delete event terkait
- Mark completed -> tidak mengubah event waktu, hanya status session dan progress kelas

---

## 5. UX Flow

## 5.1 Halaman daftar kelas

Route usulan:

- `/classes`

Tampilan:

- daftar kartu kelas
- search
- filter semester
- filter `active/completed`
- sort by `next meeting`

Setiap kartu kelas menampilkan:

- nama kelas
- semester
- progress `x / 8` atau `x / 16`
- mahasiswa
- tugas diberikan
- next meeting
- badge status

## 5.2 Halaman detail kelas

Route usulan:

- `/classes/[id]`

Blok utama:

1. **Header ringkas**
   - nama kelas
   - semester
   - jumlah mahasiswa
   - lokasi
   - target pertemuan

2. **Progress bar**
   - `completed_meeting_count / meeting_target`

3. **Stats cards**
   - total pertemuan selesai
   - tugas diberikan
   - next meeting
   - attendance terakhir

4. **List pertemuan**
   - pertemuan ke-
   - tanggal/jam
   - topik
   - status
   - ada tugas atau tidak
   - quick actions

5. **Reflection log**
   - catatan setelah mengajar

## 5.3 Modal create class

Input minimal:

- nama kelas
- kode mata kuliah
- semester
- target pertemuan `8` / `16`
- jumlah mahasiswa
- hari
- jam mulai
- jam selesai
- tanggal pertemuan pertama
- lokasi

Saat submit:

- generate seluruh meeting schedule
- tampilkan preview singkat
- confirm create

## 5.4 Edit pertemuan

Aksi per session:

- edit topik
- ubah jadwal
- tandai selesai
- isi attendance
- tandai `memberi tugas`
- isi reflection note

---

## 6. Progress & Counter Logic

### 6.1 `completed_meeting_count`

Naik ketika session berubah menjadi `completed`.

### 6.2 `assignment_count`

Naik ketika session `assignment_given = true`.

### 6.3 Progress percentage

```text
progress = completed_meeting_count / meeting_target * 100
```

### 6.4 Status kelas

Usulan:

- `active` -> masih berjalan
- `completed` -> semua meeting selesai
- `archived` -> semester lama, hidden dari fokus utama

---

## 7. API / SWR / Server Actions Pattern

Mengikuti pola repo saat ini:

### 7.1 Route Handlers

| Route | Method | Fungsi |
|------|--------|--------|
| `/api/classes` | `GET` | list kelas |
| `/api/classes` | `POST` | create class |
| `/api/classes/[id]` | `GET` | detail kelas |
| `/api/classes/[id]` | `PATCH` | update kelas |
| `/api/classes/[id]` | `DELETE` | soft delete kelas |
| `/api/classes/[id]/sessions` | `GET` | list sesi kelas |
| `/api/classes/[id]/sessions` | `POST` | create session manual |
| `/api/class-sessions/[id]` | `PATCH` | update session |
| `/api/class-sessions/[id]` | `DELETE` | soft delete session |

### 7.2 Hooks

| Hook | Fungsi |
|------|--------|
| `useClasses()` | list kelas |
| `useClass(id)` | detail kelas |
| `useClassSessions(classId)` | list pertemuan |
| `useClassStats()` | optional agregasi dashboard |

### 7.3 Server Actions

| Action | Fungsi |
|--------|--------|
| `createClassCourse()` | create kelas + generate sessions + generate calendar events |
| `updateClassCourse()` | update kelas |
| `deleteClassCourse()` | soft delete kelas + cascade soft delete sessions/events |
| `updateClassSession()` | edit pertemuan |
| `markClassSessionCompleted()` | tandai selesai + recompute progress |
| `toggleClassAssignment()` | toggle tugas pada pertemuan |
| `rescheduleClassSession()` | ubah jadwal + sync ke calendar |

---

## 8. AI & Telegram Integration

## 8.1 AI Command examples

### Create class

> `Buat kelas E-Business semester genap, 8 pertemuan, tiap Rabu 10 pagi mulai 14 Mei`

### Update progress

> `Tandai kelas Pemasaran Digital pertemuan 5 sudah selesai, bahas SEO dasar, hadir 31 mahasiswa, kasih tugas audit landing page`

### Query / recall

> `Kelas Digital Marketing saya sudah sampai pertemuan berapa?`

> `Berapa kali saya kasih tugas di kelas E-Business?`

## 8.2 Telegram recall support

Bot Telegram nantinya harus bisa menjawab:

- kelas apa yang berikutnya berlangsung
- progress kelas tertentu
- kelas mana yang tertinggal
- topik pertemuan terakhir
- apakah minggu ini ada kelas yang bentrok

Supaya cepat, query harus langsung ke `class_courses` + `class_sessions`, bukan dump semua data ke prompt.

---

## 9. Dashboard Integration

Setelah modul ini jadi, dashboard home bisa punya:

- widget `Kelas Aktif`
- next class summary
- kelas yang progresnya tertinggal
- pertemuan minggu ini

Saran widget:

- `2 kelas berikutnya`
- `1 warning kelas yang tertinggal`
- `quick mark selesai`

---

## 10. Validasi dan Rules

### 10.1 Rule create class

- `meeting_target` hanya `8` atau `16`
- tanggal pertemuan pertama wajib
- waktu selesai harus > waktu mulai

### 10.2 Rule session update

- `meeting_number` tidak boleh duplikat per kelas
- attendance tidak boleh melebihi `student_count` kelas
- jika session diberi `assignment_due_at`, timestamp harus setelah `start_at`

### 10.3 Rule soft delete

- kelas tidak boleh hard delete
- session tidak boleh hard delete
- calendar event hasil kelas juga tidak boleh hard delete

---

## 11. Acceptance Criteria

- User bisa membuat kelas `8` atau `16` pertemuan.
- Sistem otomatis membuat seluruh pertemuan awal.
- Semua pertemuan muncul di Calendar.
- User bisa mark session selesai.
- Progress kelas naik otomatis.
- User bisa mencatat attendance ringkas dan assignment per session.
- User bisa melihat jumlah tugas yang sudah diberikan.
- User bisa recall progres kelas lewat AI / Telegram.

---

## 12. Tahap Implementasi yang Disarankan

### Step 1 — Database + types

- migration `class_courses`
- migration `class_sessions`
- update types

### Step 2 — read/write foundation

- route handlers
- hooks
- server actions

### Step 3 — calendar sync

- generator session -> calendar event
- reschedule sync

### Step 4 — UI

- classes list
- class detail
- create/edit modal

### Step 5 — AI recall + command

- create/update/query class via AI
- Telegram recall

---

## 13. Keputusan Scope

### Masuk MVP modul ini

- kelas
- sesi/pertemuan
- progress
- assignment count
- attendance count ringkas
- reflection note
- sync calendar

### Tidak masuk dulu

- daftar mahasiswa satu-satu
- grading
- upload tugas mahasiswa
- diskusi kelas
- rubrik penilaian

Ini sengaja supaya modul tetap tajam dan cepat selesai.
