# 🐛 BUG-HISTORY — Personal Dashboard

> Format sesuai [skill-coding-agent.md](file:///G:/SKILL%20AGENT/skill-coding-agent.md) Section 4.
> Catat semua bug dengan disiplin. Bug yang tidak dicatat = bug yang akan terulang.

---

## Recurring Patterns to Watch

| Pattern | Deskripsi | Pencegahan |
|---------|-----------|------------|
| **Fire-and-Forget** | UI update duluan, DB gagal diam-diam | Await semua DB ops, handle error eksplisit |
| **Stale Reference** | SWR cache tidak sinkron setelah mutation | Selalu `mutate()` setelah Server Action |
| **Client Logic Leak** | Business logic di browser | Pindahkan ke Server Action / Route Handler |
| **Missing Rollback** | Optimistic update gagal tanpa rollback | SWR mutate dengan rollback on error |
| **Race Condition** | Concurrent writes (auto-save + manual save) | Debounce auto-save, queue mutations |
| **Premature Optimization** | Optimize sebelum ada masalah nyata | Profile dulu, optimize setelahnya |

---

## Log

## BUG-001 | 2026-04-27 | SEVERITY: High

**Gejala:** TypeScript build gagal di `src/app/api/ai/command/route.ts` dengan error `Property 'catch' does not exist on type 'PromiseLike<...>'`.
**Root Cause:** Query builder Supabase di-route AI di-chain dengan `.then(...).catch(...)`, padahal typing result-nya bukan `Promise` penuh yang aman untuk pola itu.
**Fix:** Ganti fallback query menjadi pola `Promise.allSettled()` + handling `error` dari hasil Supabase secara eksplisit.
**Pelajaran:** Untuk query Supabase, lebih aman perlakukan hasilnya sebagai response object dan handle `error`/fallback secara eksplisit daripada mengandalkan chaining `catch`.
**Status:** RESOLVED
**Terkait:** `src/app/api/ai/command/route.ts`

## BUG-002 | 2026-04-27 | SEVERITY: High

**Gejala:** `next build` gagal saat mengambil `Geist`, `Geist Mono`, dan `Inter` dari Google Fonts.
**Root Cause:** Layout app dan public blog masih memakai `next/font/google`, sehingga production build membutuhkan akses jaringan keluar.
**Fix:** Ganti font remote menjadi font stack lokal via CSS variables agar build tetap jalan di environment tanpa akses internet.
**Pelajaran:** Untuk proyek yang perlu build reproducible di CI atau sandbox terbatas, hindari ketergantungan font remote saat build.
**Status:** RESOLVED
**Terkait:** `src/app/layout.tsx`, `src/app/public-blog/layout.tsx`, `src/app/globals.css`

## BUG-003 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Lint global menghasilkan ribuan error dari `.next-build/**` yang bukan source code proyek.
**Root Cause:** Konfigurasi ESLint belum mengabaikan direktori output build tambahan selain `.next/**`.
**Fix:** Tambahkan ignore eksplisit untuk `.next-build/**` agar lint hanya memeriksa source yang relevan.
**Pelajaran:** Folder artefak build harus selalu dikecualikan dari lint supaya sinyal error tetap akurat.
**Status:** RESOLVED
**Terkait:** `eslint.config.mjs`

## BUG-004 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Lint masih gagal di beberapa halaman dashboard/blog karena state sync yang tidak aman, helper upload yang rawan stale closure, dan SSR public blog yang masih memakai `any`.
**Root Cause:** Beberapa komponen mock masih memakai pola cepat yang belum diselaraskan dengan aturan React lint dan type-safety repo.
**Fix:** Refactor state editor agar berbasis remount, stabilkan upload mock dengan ID per file, dan pindahkan mapping relasi blog ke helper typed.
**Pelajaran:** Walau halaman masih mock, pola state dan typing tetap perlu rapi supaya fondasi backend integration tidak rapuh.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/app/(dashboard)/vault/page.tsx`, `src/app/public-blog/*.tsx`

## BUG-005 | 2026-04-27 | SEVERITY: High

**Gejala:** `next build` gagal saat prerender `/login` dengan pesan `useSearchParams() should be wrapped in a suspense boundary`.
**Root Cause:** Halaman login memakai `useSearchParams()` di Client Component tanpa `Suspense`, yang lolos di dev tetapi gagal pada production prerender Next 16.
**Fix:** Bungkus bagian yang memakai `useSearchParams()` dengan boundary `Suspense`.
**Pelajaran:** Untuk App Router, hook URL client seperti `useSearchParams()` harus diverifikasi di mode production, bukan hanya `next dev`.
**Status:** RESOLVED
**Terkait:** `src/app/(auth)/login/page.tsx`

## BUG-006 | 2026-04-27 | SEVERITY: High

**Gejala:** Global search lintas modul belum memfilter data berdasarkan `user_id`, meski route sudah memanggil `requireAuth()`.
**Root Cause:** Query paralel di `/api/search` hanya memfilter `is_deleted`, sehingga secara logika bisa menarik data milik user lain bila RLS longgar atau salah konfigurasi.
**Fix:** Tambahkan filter `user_id = authUser.id` di semua query search dan rapikan mapping hasil.
**Pelajaran:** Auth helper tidak menggantikan kebutuhan filter eksplisit pada query aplikasi, terutama untuk endpoint agregasi lintas modul.
**Status:** RESOLVED
**Terkait:** `src/app/api/search/route.ts`

## BUG-007 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Filter waktu di halaman catatan sudah muncul di UI tetapi belum memengaruhi hasil sama sekali.
**Root Cause:** State `selectedTime` disimpan tetapi tidak dipakai di fungsi filter notes.
**Fix:** Terapkan filter berbasis `created_at` untuk `today`, `7d`, `30d`, dan `all`.
**Pelajaran:** UI filter yang belum tersambung ke data lebih berbahaya daripada tidak ada filter karena memberi rasa selesai yang palsu.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-008 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Light mode terasa silau dan beberapa permukaan serta accent text terlalu tipis kontrasnya, terutama di command palette dan halaman public blog.
**Root Cause:** Token warna light theme terlalu dekat satu sama lain, ditambah beberapa komponen masih memakai surface dan accent yang lebih cocok untuk dark mode.
**Fix:** Pertegas palette light mode di global tokens, ganti beberapa surface hardcoded menjadi semantic tokens, dan naikkan kontras accent text agar tetap terbaca di latar terang.
**Pelajaran:** Theme token yang terlihat “halus” di mockup belum tentu nyaman dipakai lama; untuk light mode, hierarchy antar surface dan text harus diuji terhadap kelelahan mata, bukan estetika saja.
**Status:** RESOLVED
**Terkait:** `src/app/globals.css`, `src/components/shared/CommandPalette.tsx`, `src/app/public-blog/*.tsx`

## BUG-009 | 2026-04-27 | SEVERITY: High

**Gejala:** Halaman login masih diimplementasikan sebagai Client Component penuh, padahal aturan arsitektur project menetapkan login page harus server-first dan auth redirect perlu aman terhadap URL tujuan setelah login.
**Root Cause:** Logic auth UI, pembacaan query redirect, dan submit handling masih disatukan di `page.tsx`, sehingga boundary server/client kabur dan validasi redirect belum eksplisit.
**Fix:** Pindahkan `login/page.tsx` menjadi Server Component, ekstrak form interaktif ke komponen client terpisah, dan sanitasi redirect target agar hanya mengarah ke route internal yang aman.
**Pelajaran:** Untuk halaman auth di App Router, server/client boundary harus sengaja dipisahkan supaya redirect, gating, dan query handling tidak bocor ke pola client-first yang lebih rapuh.
**Status:** RESOLVED
**Terkait:** `src/app/(auth)/login/page.tsx`, `src/actions/auth.actions.ts`, `src/proxy.ts`

## BUG-010 | 2026-04-27 | SEVERITY: High

**Gejala:** Route `/api/ai/command` baru berhenti di level draft parsing SSE, sehingga backend route AI belum bisa mengeksekusi perintah aplikasi secara langsung untuk membuat note, task, calendar event, dan item lain.
**Root Cause:** Execution logic hanya tersedia di Server Action terpisah, belum dibuka sebagai mode resmi di route handler AI command.
**Fix:** Tambahkan helper bersama untuk prompt context + execution, buka mode `execute` di `/api/ai/command`, dan selaraskan insert AI ke tabel aplikasi yang benar termasuk `academic_vault_items`.
**Pelajaran:** Kalau AI diposisikan sebagai command hub, parse dan execute tidak boleh hidup di dua jalur yang terpisah total; keduanya perlu berbagi helper agar perilaku draft dan eksekusi tetap konsisten.
**Status:** RESOLVED
**Terkait:** `src/app/api/ai/command/route.ts`, `src/actions/ai.actions.ts`, `src/lib/ai/*`

## BUG-011 | 2026-04-27 | SEVERITY: Critical

**Gejala:** User bisa berhasil autentikasi, tetapi fitur write seperti task gagal tersimpan ke database dan terkesan "belum konek".
**Root Cause:** Flow auth belum menjamin row `public.users` ikut dibuat/diselaraskan setelah akun Supabase Auth login/signup, padahal banyak tabel aplikasi memakai foreign key ke `public.users(id)`.
**Fix:** Tambahkan auto-provision profil user di layer auth untuk context yang sudah authenticated, sinkronkan email bila perlu, dan panggil provisioning ini dari `requireAuth()` serta login flow.
**Pelajaran:** Kalau schema aplikasi memisahkan `auth.users` dan `public.users`, provisioning profile bukan aksesoris; itu bagian inti dari handshake login sebelum modul CRUD lain bisa dipercaya.
**Status:** RESOLVED
**Terkait:** `src/lib/auth.ts`, `src/actions/auth.actions.ts`, `src/app/api/user/route.ts`

## BUG-012 | 2026-04-27 | SEVERITY: High

**Gejala:** Beberapa fitur terlihat hidup di UI tetapi belum benar-benar menjalankan integrasi production, terutama upload dokumen di Vault yang masih memakai simulasi progress lokal.
**Root Cause:** Sebagian interaksi lanjutan masih berupa mock UX/placeholder dan belum dipasangkan ke Supabase Storage atau mutation backend final.
**Fix:** Tambahkan Server Action upload dokumen ke bucket Supabase Storage `vault`, simpan metadata ke `academic_vault_items`, dan buat signed URL untuk download/share file private.
**Pelajaran:** UI progress tidak boleh dianggap fitur selesai; upload dianggap live hanya jika file masuk storage dan record metadata tersimpan di database.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`

## BUG-013 | 2026-04-27 | SEVERITY: Critical

**Gejala:** Project belum punya migration SQL yang tersimpan di repo, sehingga schema Supabase sulit direproduksi dan troubleshooting koneksi fitur ke database jadi mengandalkan setup manual lama.
**Root Cause:** Struktur schema masih terdokumentasi di file markdown, tetapi belum dipaketkan menjadi file migration yang bisa dijalankan ulang.
**Fix:** Tambahkan script reset tabel public dan migration baseline Supabase yang membangun ulang schema, helper function, trigger, index, dan RLS sesuai codebase aktif.
**Pelajaran:** Dokumen arsitektur tidak cukup untuk operasional; schema yang dipakai aplikasi harus selalu punya bentuk executable yang versioned di repo.
**Status:** RESOLVED
**Terkait:** `supabase/migrations/*`, `supabase/scripts/*`, `docs/Backend-Plan-Part1-Architecture.md`

## BUG-014 | 2026-04-27 | SEVERITY: Critical

**Gejala:** Migration Supabase gagal dijalankan dari SQL Editor dengan error `42601: syntax error at end of input`.
**Root Cause:** SQL yang dijalankan kemungkinan tidak lengkap saat dipaste, dan policy RLS awal terlalu padat sehingga sulit diaudit saat ada bagian yang terpotong.
**Fix:** Rapikan migration menjadi satu file rebuild utuh dengan sentinel akhir, policy RLS dipisah per operasi mengikuti pola dokumentasi Supabase, serta audit trigger dibuat aman untuk operasi `DELETE`.
**Pelajaran:** Migration panjang perlu punya marker akhir dan struktur policy yang eksplisit agar mudah diverifikasi sebelum dipaste ke SQL Editor.
**Status:** RESOLVED
**Terkait:** `supabase/scripts/001_rebuild_public_schema.sql`, `supabase/migrations/202604270001_initial_schema.sql`

## BUG-015 | 2026-04-27 | SEVERITY: High

**Gejala:** Tombol `Log out` tampil di sidebar tetapi tidak menjalankan aksi logout, dan kartu profil sidebar masih hardcoded.
**Root Cause:** UI sidebar belum dihubungkan ke `logoutAction()` dan belum membaca profile dari endpoint `/api/user`.
**Fix:** Hubungkan tombol logout melalui form Server Action dan tampilkan nama/email user dari hook `useUser()`.
**Pelajaran:** Auth tidak cukup ada di server action; entry point UI harus benar-benar memanggil action tersebut agar flow end-to-end bisa dites.
**Status:** RESOLVED
**Terkait:** `src/components/shared/AppSidebar.tsx`, `src/actions/auth.actions.ts`

## BUG-016 | 2026-04-27 | SEVERITY: High

**Gejala:** Editor Blog CMS menampilkan tombol Save Draft/Publish, tetapi tombol tersebut belum menyimpan perubahan ke database.
**Root Cause:** Halaman create/edit blog masih mengelola state lokal tanpa memanggil Server Action `createBlogPost`/`updateBlogPost`.
**Fix:** Sambungkan editor baru dan editor edit ke Server Actions, isi `content_text`, `content_html`, excerpt/meta, status, visibility, word count, dan reading time.
**Pelajaran:** Halaman editor dianggap selesai hanya jika aksi utama menulis ke tabel produksi, bukan sekadar state lokal di browser.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/blog/new/page.tsx`, `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/actions/blog.actions.ts`

## BUG-017 | 2026-04-27 | SEVERITY: High

**Gejala:** Login terlihat gagal tanpa pesan yang jelas di UI.
**Root Cause:** Komponen menggunakan `toast.error()` dari Sonner, tetapi root layout belum memasang provider `<Toaster />`, sehingga error auth tidak muncul.
**Fix:** Tambahkan `<Toaster />` di root layout agar pesan login/signup/logout dan mutation terlihat.
**Pelajaran:** Feedback UX adalah bagian dari flow auth; error yang tidak terlihat membuat bug backend terlihat seperti bug login.
**Status:** RESOLVED
**Terkait:** `src/app/layout.tsx`, `src/components/auth/LoginForm.tsx`

## BUG-018 | 2026-04-27 | SEVERITY: Medium

**Gejala:** PRD menyebut Settings, Telegram, dan notifikasi sebagai bagian MVP, tetapi belum punya kontrak implementasi detail yang sinkron dengan schema aktual dan roadmap pengerjaan berikutnya.
**Root Cause:** Dokumen PRD masih berfokus pada visi dan arsitektur awal, sementara implementasi sudah bergerak ke nama tabel/route/action nyata seperti `notifications`, `academic_vault_items`, dan `/api/ai/command`.
**Fix:** Update PRD ke v4 dengan addendum sinkronisasi fitur, acceptance criteria, environment variables, dan urutan implementasi Settings, Telegram, notifikasi, serta command AI.
**Pelajaran:** PRD harus ikut berevolusi saat schema dan route sudah konkret, supaya fitur tidak terasa selesai hanya karena disebut di dokumen.
**Status:** RESOLVED
**Terkait:** `docs/PRD-Personal-Dashboard.md`

## BUG-019 | 2026-04-27 | SEVERITY: High

**Gejala:** Halaman Settings menampilkan form profil, role, Telegram, dan notifikasi, tetapi perubahan hanya hidup di client state/default value dan tidak tersimpan ke Supabase.
**Root Cause:** Belum ada `settings.actions.ts`, type preferences belum menampung field v4, dan UI masih memakai toast lokal tanpa mutation backend.
**Fix:** Tambahkan `settings.actions.ts`, perluas `UserPreferences`, dan wire halaman Settings ke Server Actions untuk profile, preferences, Telegram connect/disconnect, test notification, dan test Telegram.
**Pelajaran:** Halaman pengaturan paling rawan memberi ilusi selesai karena UI form terlihat lengkap; persistence DB harus jadi acceptance criteria utama.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/settings/page.tsx`, `src/core/types/index.ts`

## BUG-020 | 2026-04-27 | SEVERITY: High

**Gejala:** Notification widget membaca data, tetapi belum bisa membuat notifikasi, mark all read, dispatch cron, atau mengirim Telegram.
**Root Cause:** Route `/api/notifications` baru punya `GET`, belum ada actions/route mutation, service-role client, Telegram helper, dan cron/webhook route.
**Fix:** Tambahkan notification actions, `POST/PATCH /api/notifications`, cron route, Telegram helper, service-role client, Telegram webhook, dan migration index idempotency.
**Pelajaran:** Notifikasi bukan sekadar list UI; sistemnya harus punya queue lifecycle lengkap dari create -> pending -> sent/failed.
**Status:** RESOLVED
**Terkait:** `src/app/api/notifications/route.ts`, `src/components/modules/dashboard/WidgetNotifications.tsx`

## BUG-021 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Reminder kalender yang dibuat lewat AI Command Hub berpotensi tidak menghasilkan notifikasi kalender.
**Root Cause:** Logic pembuatan notification reminder tersisip di branch `NOTE`, bukan branch `CALENDAR`, saat menambahkan trigger notifikasi untuk hasil execution AI.
**Fix:** Pindahkan logic reminder ke branch `CALENDAR` dan jadikan helper execution bisa dipakai ulang oleh Telegram confirm dengan Supabase service role.
**Pelajaran:** Saat menambah side-effect lintas modul, tempat branch action harus dicek dua kali karena TypeScript tidak selalu bisa menangkap salah lokasi logic.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/command-hub.ts`, `src/app/api/webhook/telegram/route.ts`

## BUG-022 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Dashboard home masih berisi placeholder/hardcoded UI seperti nama greeting statis, tombol export tanpa aksi, dan label footer catatan yang salah konteks.
**Root Cause:** Shell dashboard sudah dipoles visual lebih dulu, tetapi beberapa entry point utama belum dihubungkan ke data user dan action nyata.
**Fix:** Sambungkan greeting ke profile user, aktifkan export dashboard via route khusus, perbaiki label/copy widget, hilangkan header action no-op, dan tambah empty states yang jujur.
**Pelajaran:** Di halaman home, placeholder kecil cepat terasa “bug produk” karena posisinya paling sering dilihat user.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/page.tsx`, `src/components/modules/dashboard/*`

## BUG-023 | 2026-04-27 | SEVERITY: High

**Gejala:** Ringkasan dashboard berpotensi meleset karena kalkulasi hari ini dan kebiasaan 7 hari masih rentan timezone UTC, urutan log, dan query agregasi tanpa filter `user_id` eksplisit.
**Root Cause:** Widget dan stats route mengandalkan sorting/filter ringan di client dan asumsi waktu lokal/UTC, padahal data dashboard perlu konsisten dengan preferensi timezone user dan query backend yang tegas.
**Fix:** Tambahkan filter `user_id` eksplisit di route dashboard terkait, normalisasi tanggal dashboard berbasis timezone user, urutkan dan bentuk ulang matrix habit 7 hari, serta perbaiki widget task/calendar agar metriknya sesuai label.
**Pelajaran:** Dashboard summary harus lebih ketat daripada halaman detail karena error kecil di agregasi langsung merusak kepercayaan user pada seluruh aplikasi.
**Status:** RESOLVED
**Terkait:** `src/app/api/dashboard/stats/route.ts`, `src/components/modules/dashboard/*`

## BUG-024 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Widget agenda di dashboard hanya menonjolkan event hari ini, sehingga event besok atau event terdekat berikutnya mudah terlewat walau justru lebih penting untuk perencanaan.
**Root Cause:** Filter widget agenda masih berbasis `today` dan copy header masih mengarahkan perhatian ke hari ini saja.
**Fix:** Ubah widget agenda menjadi mode `upcoming`, tampilkan event yang sedang berlangsung atau paling dekat ke depan dengan label waktu yang lebih kontekstual.
**Pelajaran:** Widget home dashboard sebaiknya membantu antisipasi, bukan hanya memotret kondisi hari ini secara sempit.
**Status:** RESOLVED
**Terkait:** `src/components/modules/dashboard/WidgetCalendar.tsx`

## BUG-025 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Widget catatan di dashboard masih pasif; belum ada shortcut tambah catatan dan catatan pinned belum mendapat perlakuan khusus atau aksi pin cepat.
**Root Cause:** Widget notes baru berfungsi sebagai preview list sederhana, tanpa shortcut mutation dan tanpa pemisahan visual antara pinned notes dan catatan biasa.
**Fix:** Tambahkan quick add note langsung di widget, tampilkan pinned notes sebagai section terpisah, dan sediakan pin/unpin action cepat dari widget.
**Pelajaran:** Untuk dashboard home, aksi kecil yang sering dipakai lebih berharga daripada navigasi tambahan satu klik.
**Status:** RESOLVED
**Terkait:** `src/components/modules/dashboard/WidgetNotes.tsx`

## BUG-026 | 2026-04-27 | SEVERITY: High

**Gejala:** Widget tugas di dashboard masih dominan sebagai preview, belum cukup cepat untuk alur harian seperti tambah task singkat, checklist langsung, atau membaca prioritas kerja tanpa pindah halaman.
**Root Cause:** Widget task masih mewarisi pola list pasif dan belum mengangkat mutation paling sering dipakai ke permukaan dashboard home.
**Fix:** Tambahkan quick add task langsung di widget, toggle status inline, ringkasan konteks `urgent / due hari ini / upcoming`, penanda sinkronisasi hari dengan agenda, dan empty state dengan CTA yang benar-benar membantu mulai dari dashboard.
**Pelajaran:** Widget dashboard terbaik bukan miniatur halaman detail, tapi panel kerja cepat untuk aksi yang paling sering diulang.
**Status:** RESOLVED
**Terkait:** `src/components/modules/dashboard/WidgetTasks.tsx`

## BUG-027 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Dashboard home belum punya ringkasan naratif dan activity feed, sehingga walau angkanya ada, user masih harus membaca banyak widget untuk tahu apa yang paling penting dilakukan sekarang.
**Root Cause:** Home dashboard baru mengandalkan stat cards dan widget per modul, tanpa lapisan sintesis lintas modul seperti summary bar, task-calendar sync hint, dan aktivitas terbaru.
**Fix:** Tambahkan focus strip berisi ringkasan naratif lintas modul, mini activity feed berbasis `audit_logs`, dan sinkronisasi task-kalender yang tampil baik di ringkasan home maupun widget tugas.
**Pelajaran:** Semakin banyak modul aktif, semakin penting dashboard punya lapisan “interpretasi”, bukan hanya kumpulan komponen.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/page.tsx`, `src/app/api/dashboard/*`

## BUG-028 | 2026-04-27 | SEVERITY: Low

**Gejala:** Feed aktivitas terbaru berisiko tumbuh terlalu gemuk untuk dashboard home bila jumlah item yang diambil dibiarkan terlalu banyak.
**Root Cause:** Endpoint activity feed awal memakai limit yang masih bisa diperkecil tanpa mengurangi nilai ringkasan dashboard.
**Fix:** Ubah activity feed menjadi endpoint paginated dengan batas kecil per halaman, dan batasi kartu ringkasan dashboard hanya menarik 1 item terbaru.
**Pelajaran:** Untuk widget home, informasi yang ringkas biasanya lebih bernilai daripada daftar yang panjang, sekaligus lebih aman untuk performa query berkala.
**Status:** RESOLVED
**Terkait:** `src/app/api/dashboard/activity/route.ts`

## BUG-029 | 2026-04-27 | SEVERITY: Low

**Gejala:** Focus strip 4 kartu di dashboard home terasa ramai dan menurunkan kualitas visual halaman utama.
**Root Cause:** Lapisan ringkasan naratif yang ditambahkan terlalu dominan secara visual untuk konteks dashboard ini.
**Fix:** Hapus focus strip dari dashboard home dan rapikan logic/query yang hanya dipakai untuk blok tersebut.
**Pelajaran:** Tidak semua insight tambahan layak ditempatkan di hero area; dashboard yang baik tetap perlu ruang napas dan hierarki yang tenang.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/page.tsx`

## BUG-030 | 2026-04-27 | SEVERITY: Low

**Gejala:** Widget `Agenda` dan `Catatan` terasa terlalu datar dibanding `Tugas`, sehingga komposisi dashboard terlihat jomplang.
**Root Cause:** Hanya widget tugas yang punya anchor visual kuat berupa blok warna besar, sementara dua widget lain masih mengandalkan list netral.
**Fix:** Tambahkan summary band yang lebih berwarna dan perkuat treatment visual pada card agenda serta catatan agar ritme visual dashboard lebih seimbang.
**Pelajaran:** Konsistensi dashboard bukan berarti semua widget sama, tapi tiap widget perlu bobot visual yang sepadan dengan karakter modulnya.
**Status:** RESOLVED
**Terkait:** `src/components/modules/dashboard/WidgetCalendar.tsx`, `src/components/modules/dashboard/WidgetNotes.tsx`

## BUG-031 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Saat tombol titik tiga pada card tugas diklik, popup detail tugas ikut terbuka sehingga menu aksi edit/hapus tidak bisa dipakai dengan nyaman.
**Root Cause:** Card tugas memakai `onClick` pada container untuk membuka preview, tetapi trigger dropdown dan kontrol interaktif di dalamnya belum menghentikan event bubbling.
**Fix:** Pisahkan propagation event pada trigger dropdown, item aksi, dan checkbox agar interaksi inline tidak menembak preview modal.
**Pelajaran:** Kalau seluruh card dijadikan clickable surface, semua child control yang bersifat aksi harus eksplisit menghentikan bubbling.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-032 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Setelah fix awal, klik aksi `Edit` dari menu titik tiga masih bisa memunculkan dua modal sekaligus: modal edit dan modal preview task.
**Root Cause:** Penghentian event di trigger/menu item saja belum cukup; card tetap perlu guard di level container agar klik dari area aksi internal tidak pernah dianggap sebagai klik preview.
**Fix:** Tambahkan guard berbasis `closest()` pada click handler card, tandai control aksi dengan atribut khusus, dan reset preview state saat membuka modal aksi.
**Pelajaran:** Untuk clickable card dengan nested actions, proteksi paling aman ada di parent dan child sekaligus, bukan hanya salah satunya.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-033 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Halaman `Tasks` masih terasa seperti daftar kolom statis; belum ada interaksi drag-and-drop untuk memindahkan task antar status seperti board Trello.
**Root Cause:** State task sudah dikelompokkan per status, tetapi UI kolom belum punya drag source, drop target, maupun optimistic mutation untuk perpindahan antar kolom.
**Fix:** Tambahkan native drag-and-drop pada card dan kolom status, lengkap dengan highlight drop zone dan update status optimistis ke backend.
**Pelajaran:** Untuk board-style workflow, affordance perpindahan item harus terasa langsung di UI; tanpa itu, tiga kolom hanya jadi variasi tampilan list biasa.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-034 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Setelah implementasi awal board drag-and-drop, task masih terasa tidak bisa diseret pada affordance yang paling natural.
**Root Cause:** Grip icon yang terlihat seperti handle drag justru ikut ditandai sebagai area aksi internal, sehingga `dragstart` dibatalkan saat user menyeret dari sana.
**Fix:** Lepas grip dari area aksi yang memblok drag, tambahkan cursor drag yang jelas, dan rapikan affordance supaya area seret benar-benar terasa hidup.
**Pelajaran:** Kalau UI menampilkan handle drag, handle itu harus benar-benar bisa dipakai; affordance palsu lebih buruk daripada tidak ada handle sama sekali.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-035 | 2026-04-27 | SEVERITY: High

**Gejala:** Implementasi drag-and-drop task masih belum benar-benar bisa dipakai walau affordance visualnya sudah ada.
**Root Cause:** Pendekatan native HTML5 drag-and-drop terbukti terlalu rapuh untuk struktur card interaktif ini dan tidak konsisten menangkap gesture seret di UI nyata.
**Fix:** Ganti ke drag berbasis pointer yang lebih deterministik untuk perpindahan task antar kolom status.
**Pelajaran:** Untuk card board yang penuh kontrol interaktif, gesture pointer custom sering lebih andal daripada mengandalkan HTML5 drag-and-drop bawaan browser.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-036 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Versi drag-and-drop yang hanya aktif dari handle kurang intuitif di mobile karena user cenderung mencoba menyeret seluruh card.
**Root Cause:** Gesture drag dikunci terlalu sempit pada grip icon, padahal pola board mobile lebih natural bila seluruh permukaan card bisa jadi drag surface.
**Fix:** Ubah ke full-card pointer drag dengan threshold gerak kecil agar tap biasa tetap membuka detail, sementara geser kecil langsung mengaktifkan drag.
**Pelajaran:** Di mobile, affordance terbaik biasanya adalah permukaan card itu sendiri; handle visual boleh membantu, tapi jangan jadi satu-satunya jalur interaksi.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-037 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Saat task diseret, teks di card atau area sekitar masih ikut terseleksi sehingga gesture terasa kotor.
**Root Cause:** Mode drag baru benar-benar mematikan seleksi teks setelah threshold drag tercapai, jadi browser sempat memulai text selection pada fase intent awal.
**Fix:** Nonaktifkan `user-select` sejak fase drag intent dimulai, lalu pulihkan lagi saat pointer dilepas atau dibatalkan.
**Pelajaran:** Pada gesture drag berbasis pointer, pencegahan text selection harus dimulai lebih awal daripada aktivasi visual drag.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-038 | 2026-04-27 | SEVERITY: Low

**Gejala:** Filter status di halaman `Tasks` terasa redundant dan tidak memberi nilai tambah karena board sudah dipisah jelas menjadi kolom `To Do`, `In Progress`, dan `Done`.
**Root Cause:** UI list lama masih menyisakan kontrol status terpisah walau pola interaksi utama sudah bergeser ke board per kolom.
**Fix:** Hapus filter status dari toolbar dan rapikan state/filtering yang hanya dipakai oleh kontrol tersebut.
**Pelajaran:** Saat board sudah menjadi navigasi status utama, filter tambahan yang memecah hal yang sama justru menambah kebisingan.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-039 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Kolom `Done` di board tasks berisiko terus menumpuk task selesai sampai mengganggu fokus board utama.
**Root Cause:** Semua task selesai masih diperlakukan setara di kolom `Done`, tanpa batas tampilan atau pemisahan antara progres baru dan arsip lama.
**Fix:** Batasi board `Done` ke 5 task selesai terbaru, sembunyikan task selesai yang lebih lama dari 7 hari dari tampilan utama, dan sediakan toggle arsip untuk audit saat diperlukan.
**Pelajaran:** Board operasional harian sebaiknya menonjolkan progres terbaru, sementara histori lama tetap tersedia tetapi tidak mendominasi ruang kerja utama.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/tasks/page.tsx`

## BUG-040 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Dark mode masih terasa terlalu keras untuk dipakai siang hari; latar terlalu pekat dan kontras antar surface/text sekunder masih melelahkan mata.
**Root Cause:** Token dark theme sekarang masih condong ke near-black dengan layer gap yang tegas, bagus untuk malam tetapi kurang nyaman sebagai preferensi tema harian.
**Fix:** Lembutkan palet dark mode di level token global: angkat background dari near-black, haluskan card/popover/sidebar, kurangi kekerasan border, dan naikkan kenyamanan teks sekunder.
**Pelajaran:** Dark mode yang baik untuk dipakai kapan saja bukan sekadar “gelap”, tapi harus menjaga kontras yang cukup tanpa menjadikan semua permukaan terasa keras.
**Status:** RESOLVED
**Terkait:** `src/app/globals.css`

## BUG-041 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Setelah palet dark mode global diperhalus, sidebar masih terasa lebih flat dan keras dibanding area dashboard utama, terutama di search bar, hover menu, dan panel profil bawah.
**Root Cause:** Sidebar masih terlalu mengandalkan surface `muted` generik tanpa layer khusus dark mode, sehingga state hover/active dan panel utilitas bawah belum punya kedalaman visual yang cukup.
**Fix:** Rapikan surface dark mode khusus untuk shell sidebar: haluskan latar utama, perjelas section label, beri state hover/active yang lebih lembut, dan tingkatkan kualitas visual search bar serta kartu profil.
**Pelajaran:** Setelah token global dibenahi, shell navigasi sering butuh pass terpisah agar kualitas visual antar area tetap konsisten.
**Status:** RESOLVED
**Terkait:** `src/components/shared/AppSidebar.tsx`

## BUG-042 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Flow halaman `Calendar` masih terlalu fokus ke tanggal yang dipilih, sehingga agenda terdekat kurang kelihatan, dan modal event bisa tertutup walau penyimpanan gagal.
**Root Cause:** Panel kanan hanya menampilkan detail tanggal terpilih tanpa ringkasan upcoming, sementara editor event menutup diri sebelum hasil async save benar-benar diketahui.
**Fix:** Tambahkan ringkasan agenda terdekat yang lebih actionable, urutkan event secara konsisten, dan ubah modal event agar hanya menutup setelah save berhasil.
**Pelajaran:** Untuk modul kalender pribadi, user butuh kombinasi konteks tanggal terpilih dan horizon upcoming; modal async juga tidak boleh memberi ilusi save berhasil.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/calendar/page.tsx`

## BUG-043 | 2026-04-27 | SEVERITY: High

**Gejala:** Editor `Notes` menampilkan opsi pin, tetapi status pinned dari modal belum benar-benar tersimpan ke database, dan modal ikut tertutup walau request gagal.
**Root Cause:** Payload create/update note belum membawa `is_pinned`, sementara modal editor langsung memanggil `onClose()` tanpa menunggu hasil async mutation.
**Fix:** Teruskan `is_pinned` sampai ke server action, dan ubah modal note agar hanya menutup jika create/update sukses.
**Pelajaran:** Kontrol yang terlihat aktif di form harus betul-betul mempengaruhi payload; optimistic close tanpa hasil server hanya menghasilkan UX palsu.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`, `src/actions/notes.actions.ts`

## BUG-044 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Halaman `Settings` sudah menyimpan preferensi, tetapi theme preference belum terasa hidup di app shell, belum ada ringkasan usage pribadi yang berguna, dan logout belum mendapat tempat yang jelas di halaman pengaturan.
**Root Cause:** Settings masih fokus ke form field dasar; sinkronisasi dengan `next-themes`, telemetry ringan, dan area session management belum diperlakukan sebagai bagian dari pengalaman settings.
**Fix:** Hubungkan theme preference dengan theme runtime, tambahkan pulse pemakaian ringan, dan sediakan section session/logout yang jelas.
**Pelajaran:** Settings yang baik bukan sekadar tempat menyimpan data, tetapi pusat kendali preferensi, integrasi, dan status penggunaan user.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/settings/page.tsx`

## BUG-045 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Setelah shell dark mode dibenahi, modal, dropdown, dan AI bubble masih terasa belum sekelas: surface overlay masih agak generik dan AI chat masih terasa seperti tool panel, bukan assistant personal.
**Root Cause:** Primitive overlay/menu belum mendapat pass dark-mode kedua, dan AI bubble belum punya state persistence serta kontrol percakapan yang cukup personal.
**Fix:** Perhalus dialog/dropdown di level primitive, lalu rapikan AI bubble dengan copy yang lebih personal, clear conversation, dan persistence ringan.
**Pelajaran:** Begitu shell utama matang, ketidakselarasan paling terasa justru muncul di overlay primitives dan helper surfaces seperti chat bubble.
**Status:** RESOLVED
**Terkait:** `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/shared/AIChatBubble.tsx`

## BUG-046 | 2026-04-27 | SEVERITY: High

**Gejala:** Folder `Vault` untuk mata kuliah yang sama bisa tercampur lintas semester saat dibuka, walau kartu folder di level atas sudah dipisah per semester.
**Root Cause:** State folder yang dibuka hanya menyimpan `mata_kuliah`, bukan kombinasi `mata_kuliah + semester`, sehingga query isi folder menarik dokumen dari semester lain yang namanya sama.
**Fix:** Ubah state folder terbuka menjadi key yang memuat `mata_kuliah` dan `semester`, lalu sinkronkan isi folder dan breadcrumb dengan key tersebut.
**Pelajaran:** Kalau daftar ringkasan digroup dengan composite key, state navigasinya juga harus membawa key yang sama; menyederhanakan jadi satu field akan merusak akurasi data.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`

## BUG-047 | 2026-04-27 | SEVERITY: Medium

**Gejala:** `Vault` punya aksi bookmark yang terlihat nyata padahal tidak tersimpan ke mana-mana, dan belum punya flow yang rapi untuk menyimpan dokumen akademik berbasis link eksternal tanpa upload file.
**Root Cause:** UI masih menyisakan affordance placeholder, sementara modal hanya mendukung upload file walau backend sudah mampu menyimpan referensi URL eksternal.
**Fix:** Hilangkan aksi bookmark palsu, lalu tambah mode simpan referensi link eksternal di modal vault agar user bisa menyimpan Google Drive atau URL dokumen lain dengan metadata akademik.
**Pelajaran:** Di modul penyimpanan dokumen, aksi palsu merusak kepercayaan user; lebih baik hapus affordance semu dan fokus ke flow yang benar-benar persist.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`, `src/actions/vault.actions.ts`

## BUG-048 | 2026-04-27 | SEVERITY: Medium

**Gejala:** State modal upload vault bisa menyisakan antrian file atau metadata lama saat dibuka ulang, dan empty state vault masih terlalu generik untuk kasus repo benar-benar kosong.
**Root Cause:** Modal upload tidak mereset state secara eksplisit saat ditutup, sementara empty state belum membedakan antara “tidak ada hasil filter” dan “belum punya dokumen sama sekali”.
**Fix:** Reset state modal saat ditutup dan buat empty state vault yang lebih kontekstual lengkap dengan CTA yang relevan.
**Pelajaran:** Untuk modul arsip seperti vault, hygiene state modal dan empty state yang jujur sangat menentukan rasa percaya user pada data yang disimpan.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`

## BUG-049 | 2026-04-27 | SEVERITY: Low

**Gejala:** Area filter di halaman `Vault` masih terasa berantakan secara visual karena dua kelompok filter panjang ditumpuk begitu saja, sehingga hirarki semester vs tipe dokumen kurang terbaca.
**Root Cause:** Filter masih memakai dua segmented control horizontal besar tanpa pembungkus atau label per grup yang cukup kuat, sementara toggle view ikut menempel di baris yang sama.
**Fix:** Susun ulang filter menjadi blok per kategori dengan label yang jelas, spacing yang lebih rapi, dan area toggle view yang terpisah tapi tetap satu sistem visual.
**Pelajaran:** Filter yang banyak tidak cukup hanya “muat”; mereka harus punya hirarki visual yang jelas supaya user tidak perlu memindai ulang tiap kali ingin menyaring data.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`

## BUG-050 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Daftar dokumen `Vault` masih terlalu padat di desktop dan kurang nyaman di mobile karena tampilan masih memaksa pola tabel lebar untuk semua viewport.
**Root Cause:** Komponen `DocumentTable` saat ini hanya punya satu struktur grid horizontal dengan banyak kolom, sehingga informasi penting tidak diprioritaskan ulang saat ruang layar menyempit.
**Fix:** Rapikan density tabel desktop dengan spacing dan hirarki yang lebih efisien, lalu sediakan layout card/list khusus mobile yang menampilkan metadata penting secara ringkas dan actionable.
**Pelajaran:** Untuk data dokumen yang kaya metadata, satu layout tidak cukup melayani semua viewport; desktop butuh densitas yang terukur, mobile butuh ringkasan yang diprioritaskan.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/vault/page.tsx`

## BUG-051 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Modal `Habit Baru` langsung tertutup saat tombol simpan ditekan, walau request create bisa gagal, sehingga user mendapat ilusi habit sudah tersimpan.
**Root Cause:** Form modal memanggil `onClose()` langsung dari handler tombol tanpa menunggu hasil async create habit.
**Fix:** Ubah flow create habit agar menunggu hasil save, tampilkan state loading, dan hanya menutup modal jika create benar-benar sukses.
**Pelajaran:** Form async yang menutup lebih dulu dari hasil server akan terasa cepat sesaat, tetapi merusak kepercayaan user saat ada error.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`

## BUG-052 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Habit mingguan masih dicampur ke matrix 14 hari dan stat harian, sehingga ritme weekly terlihat seolah-olah “bolong” setiap hari dan progres hari ini jadi bias.
**Root Cause:** UI habits belum membedakan pola review harian dan mingguan; semua habit diproyeksikan ke grid harian yang sama.
**Fix:** Pisahkan presentasi habit harian dan mingguan, sesuaikan summary/stat agar fokus harian hanya menghitung habit daily, dan beri ringkasan weekly yang lebih relevan.
**Pelajaran:** Frekuensi bukan sekadar label data; ia harus memengaruhi cara progres ditampilkan agar interpretasinya tidak menyesatkan.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`

## BUG-053 | 2026-04-27 | SEVERITY: Low

**Gejala:** Daftar habits masih terlalu bergantung pada grid horizontal lebar, sehingga di layar kecil pengguna harus scroll samping untuk sekadar memahami progres.
**Root Cause:** Modul habits hanya punya satu layout matrix lebar tanpa fallback mobile yang lebih ringkas.
**Fix:** Tambahkan layout card/list yang lebih ringan untuk mobile sambil mempertahankan matrix penuh di desktop.
**Pelajaran:** Untuk tracker kebiasaan, desktop boleh detail, tapi mobile harus memprioritaskan keterbacaan dan check-in cepat.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`

## BUG-054 | 2026-04-27 | SEVERITY: Medium

**Gejala:** Opsi frekuensi habit masih terlalu sempit karena hanya mendukung `daily` dan `weekly`, padahal pola kebiasaan nyata juga butuh `weekdays` dan `monthly`.
**Root Cause:** Kontrak type, UI habits, dan constraint schema Supabase sama-sama mengunci frekuensi ke dua nilai lama.
**Fix:** Perluas frekuensi habit lintas constants, type, actions/API, UI tracker, dan migration Supabase agar `daily`, `weekdays`, `weekly`, dan `monthly` didukung konsisten.
**Pelajaran:** Field enum kecil cepat terasa cukup di awal, tetapi kalau ritme data benar-benar memengaruhi UX tracker, ekspansi harus dilakukan end-to-end, bukan di label UI saja.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`, `src/core/constants.ts`, `supabase/migrations/*`

## BUG-055 | 2026-04-28 | SEVERITY: High

**Gejala:** Model `habit` masih terlalu kaku karena belum bisa mewakili jadwal hari spesifik, selang N hari, atau target beberapa kali per minggu/bulan seperti pola gym yang nyata.
**Root Cause:** Schema dan UI masih berasumsi satu field ritme sederhana, padahal beberapa pola kebiasaan butuh mode cadence + konfigurasi tambahan.
**Fix:** Refactor `habits` dari model `frequency` ke `cadence_mode` + `cadence_config`, lalu samakan logika presentasi dan progres di page habits, widget dashboard, stats, dan migration.
**Pelajaran:** Begitu sebuah fitur tracker dipakai untuk rutinitas nyata, model data perlu mengikuti variasi perilaku user; kalau tidak, UI akan terus menambal keterbatasan schema.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`, `src/components/modules/dashboard/WidgetHabits.tsx`, `src/app/api/dashboard/stats/route.ts`, `supabase/migrations/*`

## BUG-056 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Modal `Habit Baru` terpotong di viewport yang lebih pendek, sehingga bagian bawah form dan tombol aksi tidak terlihat penuh.
**Root Cause:** Dialog habit belum punya batas tinggi viewport dan belum menyediakan area scroll internal saat kontennya bertambah panjang.
**Fix:** Tambahkan `max-height` pada dialog, pindahkan konten form ke area scrollable, dan jaga footer aksi tetap mudah dijangkau.
**Pelajaran:** Modal konfigurasi yang isinya dinamis harus diperlakukan seperti mini-layout mandiri; tanpa scroll internal, panjang konten kecil saja bisa merusak usability.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`

## BUG-057 | 2026-04-28 | SEVERITY: Low

**Gejala:** Setelah modal habit dibuat aman terhadap tinggi viewport, versi desktop masih terasa terlalu linear karena seluruh field dan opsi cadence ditumpuk ke bawah.
**Root Cause:** Layout modal tetap memakai satu kolom untuk semua breakpoint, padahal di desktop tersedia ruang cukup untuk memecah informasi dasar dan konfigurasi cadence.
**Fix:** Susun modal desktop ke layout dua kolom sambil mempertahankan alur satu kolom di mobile.
**Pelajaran:** Fix overflow belum otomatis menghasilkan UX desktop yang efisien; setelah aman, hierarchy layout tetap perlu disesuaikan per breakpoint.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/habits/page.tsx`

## BUG-058 | 2026-04-28 | SEVERITY: Medium

**Gejala:** UX halaman `Catatan` masih terasa terpecah: search, filter, editor, preview, dan card list sudah berfungsi tetapi belum menyatu sebagai workspace yang enak dipakai lama, terutama di desktop.
**Root Cause:** Layout notes masih mewarisi pola vertical stacking generik, sementara modul catatan butuh hierarchy yang lebih jelas antara metadata, konten, dan aksi cepat.
**Fix:** Matangkan notes workspace dengan toolbar/filter yang lebih rapi, editor/detail modal yang lebih terstruktur di desktop, serta card note yang lebih mudah dipindai.
**Pelajaran:** Modul catatan tidak cukup “cantik” di grid; supaya terasa seperti second-brain, struktur informasi dan ritme interaksinya harus sengaja dibentuk.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-059 | 2026-04-28 | SEVERITY: Low

**Gejala:** Aksi `Share` di detail note masih pseudo-action tanpa hasil nyata, dan parsing hostname source URL di card berisiko meledak kalau URL user tidak valid.
**Root Cause:** Beberapa affordance kecil di notes masih placeholder, sementara rendering source URL belum defensif terhadap input bebas dari user.
**Fix:** Jadikan share action benar-benar menyalin ringkasan note ke clipboard, dan bungkus pembacaan hostname dengan helper aman.
**Pelajaran:** Detail UX kecil seperti share/link handling cepat merusak rasa matang sebuah modul kalau dibiarkan setengah hidup.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-060 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Editor catatan masih plain text penuh, sehingga user belum bisa memberi struktur dasar seperti bold, italic, bullet list, atau numbering langsung dari flow menulis.
**Root Cause:** Notes editor hanya menyediakan textarea polos tanpa formatting helper dan tanpa renderer untuk markup ringan di preview/detail.
**Fix:** Tambahkan formatting toolbar ringan berbasis markdown untuk notes, lalu render hasilnya di preview/detail dengan parser aman yang cukup untuk bold, italic, bullet, dan numbering.
**Pelajaran:** Untuk second-brain pribadi, rich text ringan sering lebih bernilai daripada editor kompleks; struktur dasar yang mudah diakses sudah cukup mengubah kualitas catatan.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-061 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Modal `Catatan Baru` masih terpotong di desktop setelah workspace notes diperkaya, sehingga field bawah dan footer aksi tidak selalu terlihat utuh.
**Root Cause:** Dialog editor notes masih memakai satu area scroll besar dengan tinggi kolom yang tidak dikunci, sehingga layout dua kolom bisa tumbuh melebihi viewport saat konten kiri dan textarea kanan sama-sama tinggi.
**Fix:** Ubah modal editor notes menjadi layout dialog bertinggi terkendali dengan body desktop `min-h-0`, lalu buat kolom kiri dan kanan punya scroll internal masing-masing.
**Pelajaran:** Begitu modal berubah jadi workspace dua kolom, overflow harus dikendalikan per area, bukan hanya mengandalkan satu container `overflow-y-auto`.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-062 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Toolbar format di editor notes baru menghasilkan markup markdown, tetapi user belum melihat teks benar-benar tebal, miring, atau berbentuk list saat sedang mengetik.
**Root Cause:** Editor masih berbasis `textarea`, sehingga format hanya diwakili simbol teks dan baru terasa setelah dirender di preview/detail.
**Fix:** Ganti editor note biasa menjadi rich text ringan berbasis `contenteditable`, pertahankan mode `snippet` sebagai textarea monospace, dan selaraskan preview/copy/search/widget agar membaca rich text sebagai plain text yang bersih.
**Pelajaran:** Untuk UX menulis, formatting yang baru “terasa” setelah save sering masih terasa teknis; WYSIWYG ringan jauh lebih menyenangkan untuk capture note harian.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`, `src/lib/notes.ts`, `src/components/modules/dashboard/WidgetNotes.tsx`, `src/app/api/search/route.ts`

## BUG-063 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Runtime React melempar error `The final argument passed to useEffect changed size between renders` saat membuka editor catatan rich text.
**Root Cause:** Hook sinkronisasi editor sempat memakai dependency array yang berubah terhadap state rich text saat hot update/render ulang, padahal kebutuhan sinkronisasinya sebenarnya hanya saat mode editor berubah.
**Fix:** Sederhanakan dependency `useEffect` editor agar hanya bergantung pada `noteType`, lalu pertahankan sinkronisasi konten melalui handler input/editor sendiri.
**Pelajaran:** Untuk editor `contenteditable`, efek sinkronisasi sebaiknya sesempit mungkin; terlalu banyak dependency justru memperbesar peluang konflik render dan HMR.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-064 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Deploy Vercel gagal karena repo masih mendefinisikan cron `* * * * *`, padahal plan Hobby hanya mengizinkan cron sekali per hari.
**Root Cause:** Konfigurasi scheduler belum dipindahkan dari asumsi Vercel Pro/per-minute ke infrastruktur yang benar-benar tersedia pada stack aktual, yaitu Supabase `pg_cron`.
**Fix:** Hapus cron dari konfigurasi Vercel, buat endpoint dispatch notifikasi kompatibel dengan pemanggilan `Supabase Cron`, dan sediakan script SQL terpisah untuk menjadwalkan job melalui `pg_cron` + `pg_net`.
**Pelajaran:** Scheduler perlu mengikuti batas plan deploy yang nyata; untuk stack Supabase, lebih stabil menjadikan Vercel sebagai host endpoint dan Supabase sebagai pemicu jadwal.
**Status:** RESOLVED
**Terkait:** `vercel.json`, `src/app/api/cron/notifications/route.ts`, `supabase/scripts/*`, `README.md`

## BUG-065 | 2026-04-28 | SEVERITY: Low

**Gejala:** Script setup `Supabase Cron` gagal langsung dengan error `schema "cron" does not exist` saat dijalankan di project yang extension-nya belum diaktifkan.
**Root Cause:** Script mengasumsikan `pg_cron` dan `pg_net` sudah tersedia, padahal project Supabase baru bisa saja belum mengaktifkan extension tersebut.
**Fix:** Tambahkan bootstrap `create extension if not exists` untuk `pg_cron` dan `pg_net`, lalu beri guard yang eksplisit bila schema `vault` belum tersedia.
**Pelajaran:** Script operasional sebaiknya tidak hanya mendefinisikan job, tetapi juga memvalidasi prasyarat extension agar error awal lebih membantu.
**Status:** RESOLVED
**Terkait:** `supabase/scripts/006_schedule_notifications_via_supabase_cron.sql`, `README.md`

## BUG-066 | 2026-04-28 | SEVERITY: High

**Gejala:** User yang sudah berhasil terdaftar di `auth.users` ternyata belum selalu punya row pasangan di `public.users`, sehingga fitur yang bergantung pada profil aplikasi seperti settings, notifikasi, dan koneksi Telegram bisa gagal atau terasa tidak konsisten.
**Root Cause:** Skema publik belum memiliki trigger otomatis untuk membuat profil aplikasi saat user auth baru tercipta, sehingga sistem hanya aman jika backfill manual selalu dijalankan.
**Fix:** Tambahkan trigger database untuk sinkronisasi `auth.users -> public.users`, backfill user yang sudah terlanjur ada, lalu verifikasi notifikasi test memakai row profil yang sudah konsisten.
**Pelajaran:** Untuk integrasi Supabase Auth, tabel profil aplikasi tidak boleh bergantung pada backfill manual semata; sinkronisasi otomatis adalah fondasi, bukan fitur tambahan.
**Status:** RESOLVED
**Terkait:** `supabase/migrations/*`, `supabase/scripts/*`, `public.users`, `auth.users`

## BUG-067 | 2026-04-28 | SEVERITY: High

**Gejala:** `zmaula.web.id` menampilkan layar error server saat dibuka dari browser, sehingga public blog tidak bisa diakses normal dari domain utamanya.
**Root Cause:** Halaman `public-blog` masih mengandung event handler `onSubmit` di server component, dan link-link public blog belum host-aware sehingga domain apex berisiko me-rewrite path menjadi ganda seperti `/public-blog/public-blog`.
**Fix:** Pindahkan interaksi form agar tetap server-component-safe, lalu buat semua link public blog memakai base path yang sadar host (`zmaula.web.id` vs dashboard/app domain).
**Pelajaran:** Pada App Router, public SSR page harus bebas dari client-only event handlers; selain itu, domain rewrite butuh link internal yang konsisten dengan host akhir, bukan path statis tunggal.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/*`, `src/proxy.ts`

## BUG-068 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Landing page publik belum benar-benar mewakili positioning personal owner; akses login ke dashboard juga belum ditegaskan di shell public blog, sehingga domain publik terasa cantik tapi belum cukup fungsional untuk workflow harian.
**Root Cause:** Copy, metadata, CTA, dan struktur landing page masih generik untuk blog pribadi biasa dan belum memakai informasi profil, layanan, serta domain app yang sudah diputuskan.
**Fix:** Perbarui metadata, hero, service blocks, contact links, CTA login ke `app.zmaula.web.id`, kategori utama, dan form subscription agar landing page terasa sebagai home base pribadi sekaligus pintu masuk ke dashboard.
**Pelajaran:** Untuk dual-domain app/blog, landing page publik tidak cukup hanya informatif; ia juga harus menjadi jembatan yang jelas ke area kerja utama.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/page.tsx`, `src/app/public-blog/layout.tsx`, `src/lib/app-routing.ts`

## BUG-069 | 2026-04-28 | SEVERITY: High

**Gejala:** Editor blog masih setengah kaya: create/edit belum konsisten, quote/image belum aman end-to-end, alignment dan warna teks/highlight belum ikut tersimpan, serta subscription form publik belum punya tabel tujuan di database.
**Root Cause:** Transisi dari textarea ke rich text belum menyentuh sanitizer HTML, halaman edit, dan persistence layer secara utuh; sebagian flow hanya hidup di UI tanpa kontrak storage yang final.
**Fix:** Satukan editor create/edit ke rich text helper yang sama, perluas sanitizer agar menyimpan quote, alignment, warna, highlight, dan image, lalu tambahkan table subscriber + route capture untuk subscription publik.
**Pelajaran:** Rich text yang “kelihatan jalan” di toolbar belum selesai sampai formatnya lolos sanitasi, tampil lagi dengan benar, dan data turun ke database tanpa putus di tengah.
**Status:** RESOLVED
**Terkait:** `src/components/modules/blog/BlogRichTextEditor.tsx`, `src/lib/blog-editor.ts`, `src/app/(dashboard)/blog/*`, `src/app/api/public/subscribe/route.ts`, `supabase/migrations/*`

## BUG-070 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Form subscribe publik berpotensi gagal total di production karena tabel `newsletter_subscribers` belum selalu ada, sementara editor gambar juga belum punya kontrol resize/alignment seperti editor klasik.
**Root Cause:** Persistence subscriber bergantung pada migration tabel yang belum tentu sudah diterapkan di remote project, dan rich text image handling baru berhenti di insert dasar tanpa state pengaturan gambar.
**Fix:** Tambahkan fallback capture subscriber ke storage private saat tabel belum tersedia, alihkan operasi storage server-side ke service role yang tetap diawali auth, dan tambahkan kontrol resize + alignment gambar langsung di editor.
**Pelajaran:** Untuk fitur publik, ketahanan terhadap drift infra sama pentingnya dengan UI; jangan biarkan satu tabel yang tertinggal membuat flow publik mati total.
**Status:** RESOLVED
**Terkait:** `src/app/api/public/subscribe/route.ts`, `src/actions/vault.actions.ts`, `src/app/api/blog/media/route.ts`, `src/components/modules/blog/BlogRichTextEditor.tsx`

## BUG-071 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Landing page public blog terasa terlalu ramai dan copy-nya masih mentah, sehingga belum layak diposisikan sebagai halaman production untuk blog pribadi yang fokus pada tulisan.
**Root Cause:** Halaman home public blog mencoba memuat terlalu banyak persona, service, dan CTA sekaligus, sehingga fokus editorialnya kalah oleh blok promosi dan struktur header yang tercerai.
**Fix:** Ubah home public blog menjadi layout yang lebih editorial ala publication: deskripsi diri yang singkat, kategori rapi, header yang tenang, dan daftar tulisan sebagai fokus utama.
**Pelajaran:** Landing page blog production harus membuat tulisan jadi tokoh utama; profil dan CTA cukup hadir seperlunya sebagai konteks, bukan mengambil panggung utama.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/page.tsx`, `src/app/public-blog/layout.tsx`

## BUG-072 | 2026-04-28 | SEVERITY: Low

**Gejala:** Tipografi public blog masih terasa kurang modern dan kurang nyaman dibaca karena landing page dibungkus font serif penuh, padahal visual yang diinginkan lebih dekat ke sans yang bersih dan kontemporer.
**Root Cause:** Global sans stack masih bertumpu pada fallback lama, sementara shell public blog secara eksplisit memakai kelas `font-display` yang memaksa keseluruhan halaman jatuh ke serif display.
**Fix:** Perbarui sans stack global ke urutan yang lebih dekat ke ekosistem Apple/Helvetica modern, lalu lepaskan wrapper public blog dari `font-display` agar landing page mengikuti font sans utama.
**Pelajaran:** Rasa modern pada UI sering lebih ditentukan oleh fondasi typography daripada ornamen; satu wrapper font yang salah bisa menggeser seluruh karakter halaman.
**Status:** RESOLVED
**Terkait:** `src/app/globals.css`, `src/app/public-blog/layout.tsx`

## BUG-073 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Meski lebih rapi dari sebelumnya, public blog masih terasa seperti kumpulan kartu dashboard, belum mencapai rasa publication yang bersih, lebar, dan profesional seperti blog modern yang lebih editorial.
**Root Cause:** Struktur visual masih terlalu bertumpu pada card dengan radius besar, shadow, dan sidebar yang padat, sementara section `Open Commission` belum diberi hierarki visual dan ikon yang cukup kuat.
**Fix:** Ubah landing page ke layout yang lebih full-width dan editorial, kurangi treatment card berlebih, perluas ruang baca, dan ubah `Open Commission` menjadi daftar layanan profesional dengan ikon dan ritme yang lebih tenang.
**Pelajaran:** Untuk halaman blog, rasa “professional” lebih banyak datang dari restraint: sedikit kartu, banyak ruang napas, hierarki tajam, dan section komersial yang tampil seperti bagian dari publication, bukan widget tambahan.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/page.tsx`, `src/app/public-blog/layout.tsx`, `src/components/modules/blog/PublicSubscribeForm.tsx`

## BUG-074 | 2026-04-28 | SEVERITY: High

**Gejala:** Frontpage public blog berisiko gagal mengejar target Core Web Vitals tinggi karena SSR list publik masih menarik field post terlalu gemuk, gambar belum memakai pipeline optimasi Next, dan ada request gambar eksternal yang tidak perlu.
**Root Cause:** Query list publik memakai `select *` untuk beberapa konteks yang hanya butuh ringkasan, komponen gambar masih berupa `<img>` biasa, dan avatar author bergantung pada sumber eksternal yang menambah latency.
**Fix:** Batasi query publik ke field ringkas yang benar-benar dipakai, aktifkan `next/image` dengan `remotePatterns` Supabase, preload gambar utama, dan hapus avatar eksternal agar frontpage lebih ringan dari sisi payload, LCP, dan request count.
**Pelajaran:** Untuk halaman publik, performa besar sering bocor dari hal yang kelihatan kecil: satu `select *`, satu gambar tanpa optimizer, atau satu avatar eksternal bisa menggerus skor lebih cepat daripada styling berat.
**Status:** RESOLVED
**Terkait:** `next.config.ts`, `src/app/public-blog/page.tsx`, `src/app/public-blog/[slug]/page.tsx`, `src/app/public-blog/tag/[slug]/page.tsx`

## BUG-075 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Badge angka di sidebar (`Catatan`, `Tugas`, `Kalender`) masih memakai nilai mock, sehingga UI terlihat hidup tetapi angkanya bohong dan mudah membingungkan saat data nyata sudah berjalan.
**Root Cause:** `AppSidebar` menyimpan `count` hardcoded langsung di konfigurasi menu, tanpa terhubung ke endpoint agregasi dashboard yang sebenarnya sudah tersedia.
**Fix:** Hapus count mock dari konfigurasi menu dan sambungkan badge sidebar ke `useDashboardStats`, memakai `totalNotes`, `activeTasks`, dan `upcomingEvents` dari backend.
**Pelajaran:** Badge kecil di navigasi tetap bagian dari kontrak data; kalau angkanya palsu, rasa “produk nyata” langsung turun meskipun fitur intinya sudah berjalan.
**Status:** RESOLVED
**Terkait:** `src/components/shared/AppSidebar.tsx`, `src/hooks/use-dashboard-stats.ts`, `src/app/api/dashboard/stats/route.ts`

## BUG-076 | 2026-04-28 | SEVERITY: High

**Gejala:** Layout dashboard di mobile tidak usable karena sidebar desktop selalu fixed, konten selalu menggeser `260px`, dan tidak ada hamburger menu atau drawer navigasi.
**Root Cause:** Shell `(dashboard)` hanya dirancang untuk desktop: `AppSidebar` selalu tampil fixed dan `main` selalu memakai `ml-[260px]`, tanpa breakpoint behavior atau navigasi mobile terpisah.
**Fix:** Tambahkan top bar mobile dengan hamburger, ubah `AppSidebar` menjadi dual-mode desktop/mobile memakai `Sheet`, dan buat layout utama responsif dengan `ml-0` di mobile plus padding-top yang mengakomodasi header mobile.
**Pelajaran:** Responsiveness tidak cukup di level page; kalau shell navigasinya desktop-only, semua halaman di bawahnya otomatis ikut terasa rusak di mobile.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/layout.tsx`, `src/components/shared/AppSidebar.tsx`

## BUG-077 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Header dashboard home di mobile terlihat janggal karena headline terlalu besar, blok tanggal ikut naik ke samping, dan tombol export berebut ruang dengan sapaan utama.
**Root Cause:** Header home masih memakai ritme desktop `justify-between` dengan headline, tanggal, dan aksi dalam satu baris logika yang sama, padahal ruang mobile jauh lebih sempit.
**Fix:** Pecah header mobile menjadi struktur bertingkat: sapaan lebih ringkas di atas, lalu kartu tanggal dan tombol export turun ke baris terpisah yang lebih stabil.
**Pelajaran:** Setelah shell mobile beres, hero/header per halaman tetap perlu dipikirkan ulang; layout desktop yang “sekadar dibungkus flex-wrap” hampir selalu terasa canggung di layar kecil.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/page.tsx`

## BUG-078 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Blog CMS terasa berat dan membingungkan di mobile karena daftar artikel masih dipresentasikan dengan pola tabel desktop, sementara header dan kontrol filter/search saling berebut ruang di layar kecil.
**Root Cause:** Halaman blog admin mengandalkan satu layout grid 12 kolom untuk semua viewport, tanpa representasi card khusus mobile atau pemecahan ulang ritme header dan control bar.
**Fix:** Ubah header dan search controls menjadi stack yang lebih lentur di mobile, lalu tambahkan representasi `BlogPostMobileCard` khusus untuk layar kecil sambil mempertahankan tabel ringkas untuk desktop.
**Pelajaran:** Konten admin yang sifatnya list-heavy tidak cukup dibuat “responsive” dengan mengecilkan tabel; pada mobile, sering kali ia butuh bentuk UI yang benar-benar berbeda.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/blog/page.tsx`

## BUG-079 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Halaman Catatan masih terasa canggung di mobile karena CTA header terlalu desktop, ringkasan toolbar terlalu padat, aksi kartu bergantung pada hover, dan modal editor/detail memaksa layout lebar ke viewport kecil.
**Root Cause:** UX Catatan dibangun dari asumsi pointer desktop: aksi tersembunyi di hover, footer modal horizontal, preview panel selalu tampil, dan blok statistik/toolbar tidak dipecah ulang untuk layar ponsel.
**Fix:** Rapikan header dan toolbar notes agar bertumpuk dengan sehat di mobile, tampilkan trigger aksi kartu tanpa hover dependency, dan sesuaikan modal editor/detail dengan padding, wrapping, serta footer button stack yang lebih nyaman di HP.
**Pelajaran:** Mobile polish di modul produktivitas bukan hanya soal ukuran teks; pola interaksi seperti hover, split panel, dan action row harus dinilai ulang dari nol.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-080 | 2026-04-28 | SEVERITY: High

**Gejala:** Public blog masih terasa tidak responsive di mobile karena navbar terlalu penuh, CTA hero belum benar-benar nyaman disentuh, dan beberapa heading/section spacing masih memakai ritme desktop yang terlalu lebar untuk layar kecil.
**Root Cause:** Layout public blog berkembang dari desktop-first presentation dengan CTA horizontal, padding besar, dan nav actions yang padat, tanpa pass khusus untuk breakpoint mobile.
**Fix:** Rapikan navbar dan shell public blog agar lebih ringkas di mobile, pendekkan dan stack CTA penting, lalu sesuaikan hero, listing, article page, tag page, dan section subscribe agar tipografi serta spacing-nya lebih proporsional di viewport kecil.
**Pelajaran:** Responsiveness untuk halaman blog bukan cuma soal grid; navbar, hero rhythm, dan target sentuh CTA punya pengaruh langsung pada rasa “siap production” di mobile.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/layout.tsx`, `src/app/public-blog/page.tsx`, `src/app/public-blog/[slug]/page.tsx`, `src/app/public-blog/tag/[slug]/page.tsx`

<!-- 
TEMPLATE — Copy paste untuk setiap bug baru:

## BUG-XXX | YYYY-MM-DD | SEVERITY: Critical/High/Medium/Low

**Gejala:** 
**Root Cause:** 
**Fix:** 
**Pelajaran:** 
**Status:** OPEN / INVESTIGATING / RESOLVED
**Terkait:** (file/module yang terdampak)
-->

_Belum ada bug tercatat. Development backend dimulai._

---

> **Reminder:** Setiap kali menemukan bug, segera catat di sini SEBELUM fix.
> Kalau solusi sudah dicoba 2x dan masih gagal → mundur, validasi premis.
