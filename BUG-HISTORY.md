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

## BUG-110 | 2026-04-30 | SEVERITY: High

**Gejala:** Setelah shortcut PWA lama dihapus dari home screen Android, dashboard masih tidak memunculkan install native dan hanya menampilkan warning agar tidak memakai Add to Home Screen.
**Root Cause:** Fallback Android terlalu defensif: saat Chrome tidak mengirim `beforeinstallprompt`, UI malah menampilkan toast peringatan tanpa action. Ini membingungkan, apalagi Android bisa masih menganggap PWA terinstall kalau yang dihapus hanya shortcut, bukan app/entry Chrome.
**Fix:** Hapus fallback warning Android. Dashboard hanya menampilkan tombol install saat event native `beforeinstallprompt` benar-benar tersedia; iOS tetap diberi instruksi manual karena memang tidak punya event native yang sama.
**Pelajaran:** Untuk PWA Android, jangan membuat fallback install palsu. Kalau browser tidak menyediakan prompt native, lebih baik silent dan beri panduan uninstall/reinstall terpisah.
**Status:** RESOLVED
**Terkait:** `src/components/providers/PWAProvider.tsx`

## BUG-109 | 2026-04-30 | SEVERITY: Medium

**Gejala:** Notifikasi/prompt install PWA muncul di frontpage dan blog publik, padahal area publik harus fokus membaca artikel tanpa gangguan dashboard app.
**Root Cause:** `PWAProvider` dipasang di root layout global, sehingga public blog ikut menerima fallback install toast dan native install prompt handling.
**Fix:** Membuat `PWAProvider` mengenali surface public blog (`zmaula.web.id` atau route public-blog) lalu mencegah native install prompt secara silent tanpa menampilkan toast; prompt install tetap aktif untuk dashboard app.
**Pelajaran:** Provider global perlu sadar konteks domain/surface, terutama ketika satu Next app melayani dashboard privat dan blog publik.
**Status:** RESOLVED
**Terkait:** `src/components/providers/PWAProvider.tsx`

## BUG-108 | 2026-04-30 | SEVERITY: High

**Gejala:** Gambar featured image artikel blog tidak muncul ketika link artikel diposting ke Threads, meski halaman publik sudah memiliki `og:image`.
**Root Cause:** Metadata OpenGraph memakai URL Supabase `.webp` langsung tanpa `og:image:width`, `og:image:height`, `og:url`, dan canonical eksplisit. Threads/Meta scraper lebih aman menerima image absolut dari domain artikel sendiri dalam format crawler-safe seperti PNG/JPEG.
**Fix:** Menambahkan endpoint OG image PNG 1200x630 dari domain blog sendiri, plus metadata OpenGraph/Twitter yang lebih lengkap: canonical, `og:url`, title, description, locale, author, robots, dimensi image, alt text, cache-busting versi publish, dan `type: image/png`.
**Pelajaran:** Untuk social preview, gambar yang tampil di halaman belum cukup; OG image harus crawler-safe, absolut, punya dimensi, dan tidak bergantung pada format/storage URL yang mungkin tidak disukai scraper.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/blog/[slug]/page.tsx`, `src/app/api/public/og/blog/[slug]/route.tsx`

## BUG-107 | 2026-04-30 | SEVERITY: High

**Gejala:** Saat membuat atau mengedit artikel blog, format warna font/highlight menular ke paragraf berikutnya, tidak ada clear formatting dan history palette warna, serta di artikel publish selection/kursor bisa bergeser ketika teks diblok lalu diberi bold/formatting.
**Root Cause:** Editor blog memakai `contentEditable` + `document.execCommand`, sehingga selection hilang saat toolbar/color input mengambil fokus. `onBlur` juga menulis ulang `innerHTML` via sanitizer, membuat range selection pada konten publish yang kompleks menjadi stale.
**Fix:** Migrasi `BlogRichTextEditor` ke Tiptap/ProseMirror resmi dengan extension color, highlight, underline, text-align, image, toolbar command chain, clear formatting, dan recent palette untuk text color serta highlight.
**Pelajaran:** Untuk rich text editor yang menjadi fitur inti, jangan mengandalkan `execCommand`; pakai engine editor yang punya model dokumen dan selection state eksplisit.
**Status:** RESOLVED
**Terkait:** `src/components/modules/blog/BlogRichTextEditor.tsx`, `package.json`, `package-lock.json`

## BUG-106 | 2026-04-30 | SEVERITY: High

**Gejala:** Gambar blog yang dites download masih bukan WebP, berarti fitur auto-convert dan compress belum benar-benar terjamin.
**Root Cause:** Pipeline upload hanya mengandalkan helper kompresi di client, sementara route upload server masih menerima dan menyimpan MIME/ekstensi asli seperti JPG, PNG, atau GIF. RSS juga menganggap featured image selalu JPEG.
**Fix:** Client sekarang mewajibkan gambar static dikonversi ke WebP sebelum upload, server hanya menerima `image/webp`, nama file storage dipaksa `.webp`, metadata media memakai nama WebP, dan RSS menentukan MIME image dari URL.
**Pelajaran:** Optimasi asset untuk Lighthouse harus ditegakkan sebagai kontrak server-side, bukan hanya UX/client-side helper.
**Status:** RESOLVED
**Terkait:** `src/lib/client-image.ts`, `src/app/api/blog/media/route.ts`, `src/app/api/public/rss/route.ts`, `src/app/public-blog/[slug]/ReadingProgressBar.tsx`, `src/app/public-blog/[slug]/ViewCountTracker.tsx`

## BUG-100 | 2026-04-29 | SEVERITY: High

**Gejala:** Di mobile, enter/paragraph spacing pada Blog CMS awalnya normal saat menulis, tetapi setelah disimpan lalu dibuka untuk edit lagi, jarak antar baris menjadi berlebihan; postingan publik juga ikut terlihat terlalu renggang.
**Root Cause:** Sanitizer rich text belum menormalisasi paragraph kosong berisi `<br>` secara idempotent, sementara editor/preview/public prose memberi margin/min-height paragraph yang membuat blank paragraph hasil save-load terasa berlipat.
**Fix:** Collapse consecutive blank paragraphs di sanitizer, kecilkan rhythm paragraph editor, dan set margin paragraph publik/preview agar blank paragraph tidak menciptakan jarak berlebihan.
**Pelajaran:** Rich text content harus punya pipeline HTML yang idempotent antara editor state, database, preview, dan public render.
**Status:** RESOLVED
**Terkait:** `src/components/modules/blog/BlogRichTextEditor.tsx`, `src/actions/blog.actions.ts`, `src/app/public-blog/blog/[slug]/page.tsx`

## BUG-101 | 2026-04-29 | SEVERITY: High

**Gejala:** Event kalender yang sudah disimpan tidak bisa diedit dari UI.
**Root Cause:** Action menu event disembunyikan dengan `opacity-0` sampai hover, sehingga di mobile/touch event terlihat tidak punya affordance edit; selain itu create/edit belum meneruskan `reminder_config` sehingga state form multi-reminder tidak persist penuh.
**Fix:** Buat trigger menu event selalu terlihat di mobile dan terus hanya hover-reveal di desktop, lalu teruskan `reminder_config` pada create/update event.
**Pelajaran:** CRUD kalender harus diverifikasi end-to-end: open existing event, prefill form, submit update, mutate SWR, dan re-render event.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/calendar/page.tsx`, `src/actions/calendar.actions.ts`, `src/app/api/calendar/[id]/route.ts`

## BUG-102 | 2026-04-29 | SEVERITY: High

**Gejala:** Bot Telegram belum bisa menyimpan multi-reminder untuk satu event kalender.
**Root Cause:** Schema/UI sudah mendukung `reminder_config`, tetapi AI response schema, parser, prompt, dan executor command hub masih berpusat pada `reminder_minutes` tunggal.
**Fix:** Tambahkan `reminder_config` ke `AIResponseItem`, parse rule `before_minutes` dan `same_day_at`, ajari prompt format multi-reminder, simpan config ke `calendar_events`, dan queue semua rule reminder dari event yang dibuat AI/Telegram.
**Pelajaran:** Setelah schema multi-rule hadir, semua jalur create/update calendar harus ikut mengirim `reminder_config`, bukan hanya UI/Class Management.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/parser.ts`, `src/lib/ai/command-hub.ts`, `src/app/api/webhook/telegram/route.ts`, `src/lib/ai/prompts.ts`

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

## BUG-089 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Reminder event kalender hanya bisa dibuat sebelum event dimulai, tetapi tidak bisa tepat di waktu mulai karena nilai `0 menit` diperlakukan sebagai tidak ada reminder.
**Root Cause:** UI, route handler, dan queue notifikasi sama-sama memakai coercion truthy (`|| null`, `> 0`) sehingga angka `0` hilang di tengah jalan.
**Fix:** Ubah seluruh alur kalender agar `reminder_minutes = 0` dianggap valid sebagai “saat event dimulai”, termasuk penyimpanan, enqueue notifikasi, dan label UI.
**Pelajaran:** Untuk field numerik yang punya arti bisnis pada nilai `0`, hindari pola truthy/falsy karena sangat mudah merusak intent user.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/calendar/page.tsx`, `src/app/api/calendar/route.ts`, `src/lib/notification-queue.ts`

## BUG-090 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Kalender belum mengenal hari libur nasional Indonesia, sehingga user tidak punya konteks jadwal nasional saat menyusun agenda.
**Root Cause:** Belum ada tabel sistem untuk menyimpan hari libur, belum ada sinkronisasi tahunan, dan read layer kalender hanya membaca `calendar_events` milik user.
**Fix:** Tambahkan storage `public_holidays`, helper sync tahunan, dan mode merge read-only holiday events ke tampilan kalender.
**Pelajaran:** Data referensi yang sifatnya lintas user sebaiknya dipersist di database lalu di-merge di read layer, bukan di-fetch mentah dari API publik setiap render.
**Status:** RESOLVED
**Terkait:** `src/lib/holidays.ts`, `src/app/api/calendar/route.ts`, `supabase/migrations/*`

## BUG-091 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Detail Catatan masih memotong panel ringkas untuk note panjang, dan HTML ringan seperti `<br>` kadang tampil mentah alih-alih dirender sebagai line break.
**Root Cause:** Ringkasan detail note masih memakai excerpt fixed-length, sementara parser note belum menormalkan markup HTML sederhana yang tersimpan dalam bentuk encoded text.
**Fix:** Ubah panel detail note agar menampilkan teks bersih yang bisa di-scroll tanpa dipotong kasar, lalu normalisasi encoded markup ringan seperti `<br>` sebelum sanitize/render.
**Pelajaran:** Konten long-form tidak boleh dipaksa masuk ke preview pendek di layar detail, dan parser rich text perlu toleran terhadap legacy markup yang setengah HTML setengah plain text.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`, `src/lib/notes.ts`

## BUG-092 | 2026-04-29 | SEVERITY: High

**Gejala:** Blog CMS belum punya flow AI yang benar-benar usable di editor; tombol AI masih placeholder dan belum ada pola natural untuk `blok teks -> beri instruksi -> AI edit`.
**Root Cause:** Integrasi AI blog belum punya action khusus untuk generation/editorial rewrite, dan editor belum menyimpan selection range untuk dipakai sebagai target replace.
**Fix:** Tambahkan action AI khusus blog untuk `generate section`, `edit selection`, dan `generate SEO`, lalu sambungkan ke rich text editor dengan selection-aware workflow.
**Pelajaran:** Fitur AI editor terasa berguna bukan ketika sekadar “ada tombol AI”, tapi ketika ia menempel ke gesture menulis yang natural dan hasilnya bisa langsung dipakai di dokumen.
**Status:** RESOLVED
**Terkait:** `src/components/modules/blog/BlogRichTextEditor.tsx`, `src/actions/blog.actions.ts`, `src/app/(dashboard)/blog/*`

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

## BUG-081 | 2026-04-28 | SEVERITY: High

**Gejala:** Beberapa halaman dashboard seperti Blog CMS editor dan Vault masih memaksa viewport mobile melebar sehingga user harus scroll ke samping untuk melihat keseluruhan halaman.
**Root Cause:** Ada kombinasi wrapper desktop-first seperti negative margin editor, split layout dengan sidebar fixed-width, toolbar yang tidak cukup fleksibel, dan shell/global overflow yang belum dijaga ketat.
**Fix:** Tambahkan guard `overflow-x` di global + shell dashboard, rapikan editor blog `new/edit` menjadi mobile-first stack, buat toolbar rich text lebih aman terhadap layar sempit, dan tambahkan proteksi overflow pada halaman list yang terdampak.
**Pelajaran:** Horizontal overflow di mobile jarang berasal dari satu komponen; biasanya ia bocor dari beberapa lapis kecil yang sendirian terasa aman tetapi saat digabung mendorong viewport keluar.
**Status:** RESOLVED
**Terkait:** `src/app/globals.css`, `src/app/(dashboard)/layout.tsx`, `src/components/modules/blog/BlogRichTextEditor.tsx`, `src/app/(dashboard)/blog/new/page.tsx`, `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/app/(dashboard)/blog/page.tsx`, `src/app/(dashboard)/vault/page.tsx`

## BUG-082 | 2026-04-28 | SEVERITY: High

**Gejala:** Bubble chat AI di mobile masih terasa desktop-first, belum nyaman untuk diskusi natural, dan belum punya jalur upload gambar sekali pakai untuk analisa cepat.
**Root Cause:** Komponen `AIChatBubble` hanya mendukung input teks dan request command parser tunggal, dengan panel fixed-width desktop, tanpa attachment state, tanpa history diskusi, dan tanpa aturan eksplisit bahwa `vault` di chat hanya menerima link.
**Fix:** Ubah bubble menjadi mobile-friendly, tambahkan upload gambar client-side ke base64 tanpa storage, kirim riwayat diskusi singkat ke backend, pakai prompt hybrid diskusi+draft, dan kunci agar item `ACADEMIC` hanya dibuat saat ada URL/link eksplisit.
**Pelajaran:** AI chat produktivitas tidak cukup hanya “bisa kirim prompt”; ia perlu mode diskusi yang natural, affordance mobile yang sehat, dan guardrail domain-specific supaya hasilnya tidak terlihat pintar tapi salah workflow.
**Status:** RESOLVED
**Terkait:** `src/components/shared/AIChatBubble.tsx`, `src/app/api/ai/command/route.ts`, `src/lib/ai/command-hub.ts`, `src/lib/ai/prompts.ts`, `src/lib/ai/client.ts`

## BUG-083 | 2026-04-28 | SEVERITY: High

**Gejala:** Saat bubble chat dibuka, konsol/dev log terlihat seperti loop API tak berujung karena hook dashboard berulang kali menembak endpoint `/api/*` yang gagal, terutama `404`.
**Root Cause:** Layer proxy masih ikut menangani request app API padahal route handler sudah punya auth sendiri, lalu SWR tetap melakukan retry pada error `404/401`, sehingga error endpoint kecil terasa seperti loop besar saat komponen lain memicu revalidation.
**Fix:** Keluarkan `/api/*` dari auth guard di `proxy.ts`, tambahkan status-aware error di fetcher, hentikan retry SWR untuk `401/404`, dan tambahkan guard `type="button"` pada tombol non-submit di bubble agar tidak ada submit tak sengaja.
**Pelajaran:** Pada app hybrid dengan SWR, problem “loop API” sering bukan dari satu komponen yang spam fetch, tetapi dari kombinasi proxy redirect, retry default, dan tombol UI yang tidak diberi batas perilaku eksplisit.
**Status:** RESOLVED
**Terkait:** `src/proxy.ts`, `src/lib/fetcher.ts`, `src/app/layout.tsx`, `src/components/shared/AIChatBubble.tsx`

## BUG-084 | 2026-04-28 | SEVERITY: Medium

**Gejala:** Di desktop, bagian atas bubble chat bisa kepotong saat viewport lebih pendek atau browser chrome memakan tinggi layar.
**Root Cause:** Container bubble desktop hanya di-anchor ke bawah dengan `max-height`, tanpa batas `top` yang jelas, sehingga tinggi panel bisa mendorong header keluar viewport.
**Fix:** Tambahkan batas `top` desktop dan ubah sizing panel menjadi tinggi adaptif berbasis viewport agar tetap muat penuh di layar pendek.
**Pelajaran:** Overlay fixed yang terlihat aman di layar tinggi tetap perlu guard `top/bottom` ganda supaya tidak bergantung pada viewport ideal.
**Status:** RESOLVED
**Terkait:** `src/components/shared/AIChatBubble.tsx`

## BUG-085 | 2026-04-28 | SEVERITY: High

**Gejala:** Upload gambar di blog belum dikompres otomatis, cover image blog belum benar-benar fungsional, dan catatan belum punya jalur upload gambar yang konsisten.
**Root Cause:** Upload image masih tersebar dan mentah: editor blog mengirim file asli ke server, cover image baru sebatas UI visual, dan editor catatan belum punya uploader sama sekali.
**Fix:** Tambahkan util kompresi client-side ke WebP, sambungkan ke uploader blog/editor, hidupkan cover image blog, dan tambahkan upload gambar untuk editor catatan dengan sanitizer HTML yang mengizinkan render `<img>` secara aman.
**Pelajaran:** Untuk media upload, performa tidak cukup ditangani di storage layer; kompresi dan format sebaiknya distandardisasi dekat sumber input agar semua modul mendapat perilaku yang konsisten.
**Status:** RESOLVED
**Terkait:** `src/lib/client-image.ts`, `src/app/api/blog/media/route.ts`, `src/components/modules/blog/BlogRichTextEditor.tsx`, `src/app/(dashboard)/blog/new/page.tsx`, `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/app/(dashboard)/notes/page.tsx`, `src/lib/notes.ts`

## BUG-086 | 2026-04-28 | SEVERITY: Low

**Gejala:** AI bubble masih berpotensi menanyakan identitas dasar pemilik dashboard, padahal ini aplikasi personal satu user dan konteks profil pengguna seharusnya sudah dianggap known context.
**Root Cause:** System prompt hanya membawa waktu, role, dan kategori, tetapi belum menyuntikkan profil inti pemilik workspace sebagai memory baseline.
**Fix:** Tambahkan profil permanen pengguna ke prompt AI command dan prompt AI assistant, lalu berikan aturan eksplisit agar AI tidak menanyakan siapa user atau latar dasar user lagi kecuali benar-benar dibutuhkan untuk workflow spesifik.
**Pelajaran:** Untuk asisten personal single-user, profil inti bukan dekorasi; ia harus hidup di system prompt supaya percakapan terasa cerdas dan kontekstual sejak awal.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/prompts.ts`

## BUG-087 | 2026-04-28 | SEVERITY: High

**Gejala:** Bot Telegram baru bisa menjawab command terbatas seperti `/tasks` atau `/today`, tetapi belum bisa melakukan recall natural lintas task, kalender, catatan, habit, dan vault saat user bertanya bebas.
**Root Cause:** Jalur webhook Telegram masih mengandalkan command hardcoded dan fallback ke parser AI umum, tanpa layer query recall selektif yang mengambil data transaksional relevan dari database.
**Fix:** Tambahkan `Telegram Smart Recall v1` yang mengklasifikasikan intent recall secara ringan, men-query modul yang relevan saja, lalu menyusun jawaban ringkas tanpa melempar seluruh database ke model.
**Pelajaran:** Bot personal yang cepat tidak perlu “membaca semua data”; yang penting ia tahu tabel mana yang harus ditanya untuk intent tertentu, lalu merangkum hasil query yang tepat.
**Status:** RESOLVED
**Terkait:** `src/app/api/webhook/telegram/route.ts`

## BUG-088 | 2026-04-28 | SEVERITY: High

**Gejala:** Cron notifikasi masih disetel 5 menit sekali dan reminder task/kalender hanya membuat notifikasi channel `push`, sehingga Telegram tidak menerima alert otomatis tepat ketika due/reminder jatuh tempo.
**Root Cause:** Pipeline enqueue notifikasi belum membaca preference channel user, dan script Supabase Cron masih memakai cadence 5 menit dari fase awal implementasi.
**Fix:** Pusatkan queue builder notifikasi berdasarkan preference user, buat task deadline dan calendar reminder bisa mengantre ke `telegram` juga, lalu ubah script cron Supabase menjadi 1 menit.
**Pelajaran:** Kalau satu event bisa keluar ke beberapa channel, pemilihan channel harus diputuskan saat enqueue, bukan ditambal belakangan di dispatcher.
**Status:** RESOLVED
**Terkait:** `src/actions/tasks.actions.ts`, `src/actions/calendar.actions.ts`, `src/lib/ai/command-hub.ts`, `src/lib/notification-queue.ts`, `src/app/api/cron/notifications/route.ts`, `supabase/scripts/006_schedule_notifications_via_supabase_cron.sql`

## BUG-089 | 2026-04-29 | SEVERITY: High

**Gejala:** Tombol dan field schedule di Blog CMS belum benar-benar berfungsi; post yang diberi tanggal publish tetap tidak pernah terbit otomatis saat waktunya tiba.
**Root Cause:** Tabel `blog_posts` memang sudah punya kolom `scheduled_at`, tetapi UI editor belum mengirim nilainya, server action belum memutuskan mode `scheduled draft`, dan cron 1 menit belum punya langkah untuk mempromosikan post terjadwal menjadi `published`.
**Fix:** Hidupkan alur schedule end-to-end: editor kirim `scheduled_at`, server action menyimpan draft terjadwal dengan benar, dan cron notifikasi ikut menjalankan publisher untuk semua post yang sudah jatuh tempo.
**Pelajaran:** Field database saja tidak cukup; fitur terjadwal baru hidup kalau keputusan status, UX editor, dan background job berbicara dengan aturan yang sama.
**Status:** RESOLVED
**Terkait:** `src/actions/blog.actions.ts`, `src/app/(dashboard)/blog/new/page.tsx`, `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/app/api/cron/notifications/route.ts`

## BUG-090 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Path artikel publik masih memakai pola lama yang terlalu datar, padahal artikel blog diinginkan berada di `zmaula.web.id/blog/slug` agar root path nantinya bisa dipakai untuk halaman statis/page builder.
**Root Cause:** Link home/tag/RSS/sitemap dan route public article masih dibangun di level `/${slug}` (di balik prefix `/public-blog`), sehingga struktur URL belum dipisah antara `blog post` dan `page`.
**Fix:** Pindahkan jalur artikel publik ke `/blog/[slug]`, ubah semua generator link publik mengikuti pola baru, dan redirect jalur artikel lama ke struktur baru agar backlink lama tidak putus.
**Pelajaran:** Struktur URL publik perlu dipikirkan sebagai kontrak jangka panjang; memisahkan konten blog dari page lebih aman dilakukan sebelum page builder hadir.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/page.tsx`, `src/app/public-blog/[slug]/page.tsx`, `src/app/public-blog/blog/[slug]/page.tsx`, `src/app/public-blog/tag/[slug]/page.tsx`, `src/app/public-blog/sitemap.ts`, `src/app/api/public/rss/route.ts`, `src/proxy.ts`

## BUG-091 | 2026-04-29 | SEVERITY: High

**Gejala:** Saat mengetik lalu menghapus satu huruf di editor blog, caret/kursor pengetikan meloncat kembali ke awal artikel sehingga pengalaman menulis terasa rusak.
**Root Cause:** Editor melakukan sinkronisasi `innerHTML` terkontrol terlalu agresif pada setiap input, sehingga DOM editor di-rewrite ulang setelah setiap perubahan kecil dan selection/caret hilang.
**Fix:** Ubah strategi sinkronisasi editor agar input harian hanya mengirim HTML tersanitasi ke state tanpa me-rewrite DOM aktif; rewrite penuh hanya dilakukan saat hydration awal atau saat value eksternal benar-benar berubah.
**Pelajaran:** Rich text editor tidak bisa diperlakukan seperti input biasa; kontrol penuh terhadap `innerHTML` pada setiap keystroke hampir selalu berujung pada caret jump atau selection loss.
**Status:** RESOLVED
**Terkait:** `src/components/modules/blog/BlogRichTextEditor.tsx`

## BUG-092 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Aplikasi belum benar-benar installable sebagai PWA; belum ada manifest route, icon app yang proper, registrasi service worker, dan service worker saat ini hanya no-op.
**Root Cause:** Setup web app masih berhenti di halaman web biasa tanpa metadata PWA dan tanpa lifecycle service worker yang didaftarkan dari client.
**Fix:** Tambahkan manifest Next App Router, icon/apple-icon generator, provider registrasi service worker, dan service worker ringan untuk cache aset inti serta fallback offline dasar.
**Pelajaran:** PWA yang terasa rapi butuh empat lapisan sekaligus: manifest, icon, service worker, dan registrasi client; satu lapisan saja tidak cukup untuk installability yang konsisten.
**Status:** RESOLVED
**Terkait:** `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `public/sw.js`, `src/components/providers/PWAProvider.tsx`

## BUG-093 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Pada modal detail catatan desktop, kolom kiri yang berisi isi note panjang bisa terpotong di bawah dan tidak menyediakan scroll yang sehat, sehingga bagian akhir catatan tidak bisa dibaca.
**Root Cause:** `DialogContent` dipakai dengan asumsi layout `flex column`, padahal primitive dialog default masih `grid`; akibatnya area body/footer tidak membagi tinggi dengan stabil, lalu kolom kiri juga tidak punya scroll container tersendiri saat konten lebih panjang dari viewport modal.
**Fix:** Ubah modal detail note menjadi layout `flex flex-col`, pastikan area body memakai `min-h-0`, lalu beri scroll mandiri untuk kolom kiri pada desktop agar isi catatan panjang tetap terbaca penuh.
**Pelajaran:** Pada modal tinggi dengan footer fixed, `min-h-0` dan tipe parent layout (`flex` vs `grid`) sangat menentukan apakah scroll area benar-benar hidup atau hanya terlihat benar di kasus konten pendek.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/notes/page.tsx`

## BUG-094 | 2026-04-29 | SEVERITY: High

**Gejala:** Tombol preview (icon mata) di editor blog belum menjalankan apa pun, sehingga user tidak bisa meninjau artikel saat sedang menulis tanpa publish dulu.
**Root Cause:** Toolbar editor hanya menampilkan affordance preview, tetapi belum punya handler dan belum ada surface preview yang bisa merender draft/article state saat ini.
**Fix:** Tambahkan preview modal artikel yang bisa merender konten draft lokal lengkap dengan cover, metadata, dan prose content langsung dari state editor.
**Pelajaran:** Pada CMS, affordance seperti preview bukan ornamen; kalau tombolnya terlihat seperti fitur inti, ia harus usable bahkan sebelum ada publish flow.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/blog/new/page.tsx`, `src/app/(dashboard)/blog/[id]/edit/page.tsx`, `src/components/modules/blog/BlogPreviewModal.tsx`

## BUG-095 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Pengelolaan kategori/tags blog belum matang; user hanya bisa memilih tag yang ada atau menambahkan nama sementara dari editor, tetapi belum punya panel CRUD tag yang nyata di Blog CMS.
**Root Cause:** API read tag sudah ada, tetapi belum ada server action CRUD tag dan belum ada UI manajemen tag terpusat di halaman Blog CMS.
**Fix:** Tambahkan server action create/update/delete tag dan panel manajemen kategori/tags di Blog CMS lengkap dengan warna, slug, jumlah post, edit, dan hapus.
**Pelajaran:** Kalau taxonomy dipakai untuk struktur konten publik, ia perlu panel manajemen sendiri; mengandalkan input ad-hoc di editor cepat membuat CMS terasa setengah jadi.
**Status:** RESOLVED
**Terkait:** `src/actions/blog.actions.ts`, `src/app/(dashboard)/blog/page.tsx`, `src/hooks/use-blog.ts`

## BUG-096 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Frontpage blog terlihat kosong pada section "Tulisan Terbaru" saat baru ada satu artikel publik, sehingga halaman terasa rusak walau data sebenarnya ada.
**Root Cause:** Post pertama dipakai sebagai featured post lalu dihapus dari koleksi `morePosts`, tetapi section "Tulisan Terbaru" tidak punya fallback untuk kasus hanya ada satu artikel atau belum ada artikel sama sekali.
**Fix:** Tambahkan fallback list untuk tetap menampilkan featured post di grid saat itu satu-satunya artikel, dan tampilkan empty state yang jujur kalau memang belum ada artikel publik.
**Pelajaran:** Layout editorial tidak boleh mengasumsikan jumlah konten sudah banyak; kondisi 0-1 artikel harus diperlakukan sebagai skenario utama, bukan edge case.
**Status:** RESOLVED
**Terkait:** `src/app/public-blog/page.tsx`

## BUG-097 | 2026-04-29 | SEVERITY: Medium

**Gejala:** Migration foundation `Class Management` gagal dijalankan di Supabase SQL Editor dengan error syntax di blok `ADD COLUMN`.
**Root Cause:** Statement `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... , ADD COLUMN IF NOT EXISTS ...` tidak diparse dengan aman oleh editor SQL Supabase yang dipakai user.
**Fix:** Pecah penambahan kolom `calendar_events.origin` dan `calendar_events.source_metadata` menjadi dua statement `ALTER TABLE` terpisah.
**Pelajaran:** Untuk migration yang ditujukan ke SQL Editor Supabase, lebih aman gunakan statement `ALTER TABLE` sederhana satu per satu daripada bentuk multi-add yang lebih rapat.
**Status:** RESOLVED
**Terkait:** `supabase/migrations/202604290010_class_management_foundation.sql`

## BUG-098 | 2026-04-29 | SEVERITY: High

**Gejala:** Modal `Tambah Kelas` di `Class Management` kepanjangan di viewport laptop/mobile sehingga tombol simpan terdorong keluar layar, dan field semester terasa kosong tanpa aturan default akademik yang jelas.
**Root Cause:** Layout modal masih mengikuti pola form statis tanpa area scroll internal atau footer tetap, sementara semester belum diberi rule semester akademik otomatis berbasis tanggal pertemuan pertama.
**Fix:** Ubah modal kelas menjadi `max-height` dengan body scrollable dan footer aksi tetap terlihat, lalu tambahkan default semester akademik otomatis yang mengikuti tanggal pertemuan pertama namun tetap editable.
**Pelajaran:** Form administratif yang panjang tidak cukup hanya "muat di desktop"; area aksi harus selalu terlihat, dan field akademik seperti semester harus dibantu rule domain agar user tidak dipaksa mikir dari nol.
**Status:** RESOLVED
**Terkait:** `src/app/(dashboard)/classes/page.tsx`

## BUG-099 | 2026-04-29 | SEVERITY: High

**Gejala:** Reminder kalender masih model tunggal (`reminder_minutes`) sehingga tidak bisa mengirim beberapa pengingat untuk satu event, padahal event kelas butuh pola khusus H-1, hari H jam 06:00, dan 15 menit sebelum.
**Root Cause:** Schema dan queue notifikasi kalender masih diasumsikan satu reminder per event, sehingga kelas tidak bisa mewarisi preset reminder multi-tahap yang konsisten.
**Fix:** Tambahkan `reminder_config` multi-rule pada `calendar_events`, ubah queue notifikasi agar membaca banyak rule, dan tetapkan preset reminder khusus untuk event hasil `Class Management`.
**Pelajaran:** Reminder operasional akademik hampir selalu butuh lebih dari satu momen; memodelkannya sebagai satu integer cepat mentok begitu kebutuhan nyata mulai kompleks.
**Status:** RESOLVED
**Terkait:** `src/lib/notification-queue.ts`, `src/lib/class-management.ts`, `src/app/(dashboard)/calendar/page.tsx`, `supabase/migrations/202604290011_calendar_multi_reminders.sql`

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

## BUG-100 | 2026-04-29 | SEVERITY: High

**Gejala:** Vision Telegram tidak berjalan saat memakai `gpt-5-nano` di endpoint OpenCode Responses, sehingga gambar tidak bisa dianalisis sebelum diteruskan ke model utama.
**Root Cause:** Konfigurasi vision diarahkan ke `/zen/v1/responses` dengan payload Responses API (`instructions` + `input_image`), sementara jalur OpenCode Go utama memakai endpoint chat-completions dan lebih kompatibel untuk routing model yang tersedia.
**Fix:** Alihkan vision extractor ke endpoint OpenCode Go chat-completions, gunakan model Kimi 2.6 sebagai extractor, dan tetap teruskan hasil analisis gambar sebagai teks ke model utama.
**Pelajaran:** Untuk arsitektur hybrid deterministic + AI, vision extractor sebaiknya memakai provider path yang sama stabilnya dengan model utama; jangan campur format API berbeda kalau tidak benar-benar terverifikasi.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/client.ts`, `.env.example`

## BUG-101 | 2026-04-30 | SEVERITY: High

**Gejala:** Chat bubble in-app menjawab tidak punya akses ke agenda/dashboard ketika user bertanya "besok ada agenda apa?", padahal data kalender ada di database.
**Root Cause:** Builder prompt in-app hanya mengirim kategori dan timezone, tetapi tidak mengirim snapshot database tasks/calendar/habits/notes/vault seperti jalur Telegram.
**Fix:** Tambahkan dashboard snapshot dan memory log ringkas ke `buildAICommandMessages` dan `buildAIAssistantMessages` agar chat bubble dapat menjawab dari data Supabase yang sudah terautentikasi.
**Pelajaran:** Prompt rule saja tidak cukup; kalau instruksi menyebut "DASHBOARD DATA SNAPSHOT", semua channel AI harus benar-benar diberi snapshot yang sama.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/command-hub.ts`

## BUG-102 | 2026-04-30 | SEVERITY: Medium

**Gejala:** Logika gambar di chat bubble in-app tidak sama dengan Telegram; in-app masih dapat mengirim gambar langsung ke model utama, sementara Telegram sudah memakai vision extractor lalu meneruskan hasil observasi ke model utama.
**Root Cause:** Helper vision-to-main-model hanya dibuat lokal di route Telegram, sehingga channel in-app tidak ikut memakai pipeline anti-halusinasi yang sama.
**Fix:** Pindahkan helper input vision ke command hub bersama, gunakan helper yang sama di Telegram dan in-app, lalu ubah chat bubble agar image attachment dianalisis oleh vision model sebelum main model menerima konteks teks.
**Pelajaran:** Pipeline AI lintas channel harus dibangun sebagai shared primitive; kalau helper penting tinggal di satu route, behavior cepat pecah antara Telegram dan UI dashboard.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/command-hub.ts`, `src/app/api/ai/command/route.ts`, `src/app/api/webhook/telegram/route.ts`

## BUG-103 | 2026-04-30 | SEVERITY: High

**Gejala:** Saat user Telegram meminta edit agenda, bot kadang membuat agenda baru alih-alih mengubah agenda yang sudah ada.
**Root Cause:** Guard deterministic edit hanya aktif pada pola sempit dan tidak ada fallback keras untuk mencegah LLM membuat item `CALENDAR` baru ketika intent user jelas update/edit.
**Fix:** Perluas deteksi intent edit kalender, perbaiki pencarian kandidat agenda, dan blok creation flow ketika intent edit belum berhasil dicocokkan.
**Pelajaran:** Intent mutasi pada data existing harus ditangani deterministic lebih dulu; LLM hanya boleh create ketika intent benar-benar create, bukan saat update matcher gagal.
**Status:** RESOLVED
**Terkait:** `src/app/api/webhook/telegram/route.ts`

## BUG-104 | 2026-04-30 | SEVERITY: High

**Gejala:** Multi-reminder kalender masih error di UI dan AI Bot.
**Root Cause:** Queue reminder mencoba menghapus pending notification lama, tetapi RLS awal belum memberi policy `DELETE` untuk tabel `notifications`; selain itu validasi/normalisasi reminder belum dibuat sebagai shared helper yang konsisten.
**Fix:** Tambahkan migration policy delete own notifications, normalisasi reminder rule sebelum insert/update, dan tampilkan summary multi-reminder dengan jelas di UI.
**Pelajaran:** Fitur yang membuat ulang queue harus punya izin delete/update lifecycle lengkap; kalau hanya insert policy, save event bisa gagal di tahap requeue.
**Status:** RESOLVED
**Terkait:** `src/lib/notification-queue.ts`, `src/actions/calendar.actions.ts`, `src/app/(dashboard)/calendar/page.tsx`, `supabase/migrations/202604300001_notifications_delete_own.sql`

## BUG-105 | 2026-04-30 | SEVERITY: Medium

**Gejala:** Pesan Telegram bot terlihat datar, tidak rapi, tanpa markdown, dan kurang mudah discan.
**Root Cause:** Formatter Telegram mengirim plain text mentah tanpa parse mode dan tanpa struktur visual per jenis balasan.
**Fix:** Tambahkan formatter Markdown Telegram, escape karakter markdown, dan gunakan emoji secukupnya untuk draft, hasil edit, list task/habit/today, dan error.
**Pelajaran:** Untuk channel chat, kualitas output bukan kosmetik; formatting adalah bagian dari UX dan mengurangi salah baca pada action penting.
**Status:** RESOLVED
**Terkait:** `src/app/api/webhook/telegram/route.ts`, `src/lib/telegram.ts`

_Belum ada bug tercatat. Development backend dimulai._

---

> **Reminder:** Setiap kali menemukan bug, segera catat di sini SEBELUM fix.
> Kalau solusi sudah dicoba 2x dan masih gagal → mundur, validasi premis.

## BUG-106 | 2026-05-01 | SEVERITY: High

**Gejala:** Reminder Telegram untuk kelas menampilkan copy mentah seperti `dimulai dalam 1440 menit`, dan AI chat baik Telegram maupun bubble belum mampu membuat entitas kelas nyata.
**Root Cause:** Formatter queue reminder kalender masih memakai angka menit mentah, sementara schema AI Command Hub hanya mengenal `TASK`, `NOTE`, `CALENDAR`, dan `ACADEMIC`; belum ada action `CLASS` yang tersambung ke `class_courses` + generated `class_sessions`.
**Fix:** Tambahkan formatter reminder manusiawi (`besok`, `1 jam lagi`, jam lokal event), skip reminder yang jadwal kirimnya sudah lewat, perluas AI schema/prompt/parser ke action `CLASS`, sambungkan executor ke `createClassCourseWithSessions`, dan tambahkan guard deterministic untuk mengubah draft kelas yang keliru menjadi draft `CLASS`.
**Pelajaran:** Class management bukan variasi calendar biasa; kalau fitur punya lifecycle sendiri, AI command hub juga harus punya action tersendiri agar tidak membuat data setengah matang.
**Status:** RESOLVED
**Terkait:** `src/lib/notification-queue.ts`, `src/lib/ai/command-hub.ts`, `src/lib/ai/parser.ts`, `src/lib/ai/prompts.ts`, `src/app/api/webhook/telegram/route.ts`, `src/app/api/ai/command/route.ts`

## BUG-107 | 2026-05-01 | SEVERITY: High

**Gejala:** PWA dashboard belum memberi cara install yang jelas; user tidak melihat prompt/notifikasi install, sementara PWA tidak boleh berlaku untuk halaman blog publik.
**Root Cause:** Metadata manifest PWA masih dipasang di root layout sehingga ikut diwariskan ke blog, dan fallback install helper non-iOS diam ketika event `beforeinstallprompt` tidak dipicu browser.
**Fix:** Pindahkan manifest/apple-web-app metadata ke layout dashboard saja, dan ubah fallback toast dashboard agar memberi instruksi manual Chrome/Android jika native prompt tidak muncul.
**Pelajaran:** PWA install prompt tidak boleh bergantung penuh pada `beforeinstallprompt`; browser sering menahan prompt, jadi dashboard harus punya fallback edukatif yang eksplisit.
**Status:** RESOLVED
**Terkait:** `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/providers/PWAProvider.tsx`

## BUG-108 | 2026-05-01 | SEVERITY: High

**Gejala:** Chrome laptop sudah menawarkan install PWA, tetapi Chrome Android tetap tidak menampilkan opsi install setelah shortcut lama dihapus.
**Root Cause:** Android/Chrome kemungkinan masih menyimpan identity WebAPK/shortcut lama untuk manifest `id: '/'`, sehingga situs dianggap sudah pernah ditambahkan atau status installability tertahan.
**Fix:** Ganti manifest identity dashboard ke `id: '/?pwa=dashboard-v2'` dan `start_url: '/?pwa=dashboard-v2'` agar Android melihatnya sebagai PWA candidate baru tanpa mengubah scope dashboard.
**Pelajaran:** Untuk kasus Android WebAPK yang nyangkut, mengganti manifest `id` adalah bypass yang lebih reliable daripada hanya meminta clear cache manual.
**Status:** RESOLVED
**Terkait:** `src/app/manifest.ts`

## BUG-109 | 2026-05-01 | SEVERITY: High

**Gejala:** Chrome Android tetap tidak menyediakan prompt install PWA di `app.zmaula.web.id`, meskipun service worker sudah aktif.
**Root Cause:** Route PWA public asset seperti `/manifest.webmanifest` masih terkena proxy auth guard dan diarahkan ke `/login`, sehingga Chrome menerima HTML login alih-alih manifest JSON.
**Fix:** Tambahkan daftar public PWA asset di proxy dan keluarkan `/manifest.webmanifest`, `/sw.js`, `/icon`, `/icon-192`, `/apple-icon`, serta `/offline` dari matcher auth guard.
**Pelajaran:** Asset installability PWA harus bisa diakses publik tanpa sesi login; auth guard boleh melindungi dashboard UI/data, tapi tidak boleh mengunci manifest, icon, service worker, atau offline page.
**Status:** RESOLVED
**Terkait:** `src/proxy.ts`, `src/app/manifest.ts`, `public/sw.js`

## BUG-111 | 2026-05-02 | SEVERITY: High

**Gejala:** Blog view count tidak bertambah meskipun artikel publik dibuka, dan editor Catatan memindahkan kursor/selection ke atas setelah teks diblok lalu diberi formatting.
**Root Cause:** Endpoint view counter publik memakai Supabase anon/server client sehingga fallback update terkena RLS dan gagal diam-diam ketika RPC tidak tersedia/bermasalah. Di Catatan, toolbar mengambil focus dari `contentEditable`, lalu sync editor menulis ulang `innerHTML` saat input sehingga selection browser hilang.
**Fix:** Ubah endpoint view counter menjadi trusted service-role route yang hanya meng-increment post published/public/non-deleted, perkuat tracking script dengan `sendBeacon`/`keepalive`, simpan dan restore selection editor sebelum command formatting, cegah toolbar mencuri focus dengan `onMouseDown preventDefault`, dan hentikan rewrite `innerHTML` agresif saat user mengetik.
**Pelajaran:** Counter publik butuh jalur server terpercaya yang tetap scoped, bukan update anon yang berharap lolos RLS. Untuk rich text ringan, menjaga selection lebih penting daripada sanitize DOM setiap keystroke.
**Status:** RESOLVED
**Terkait:** `src/app/api/public/blog/[id]/view/route.ts`, `src/app/public-blog/blog/[slug]/page.tsx`, `src/app/(dashboard)/notes/page.tsx`

## BUG-112 | 2026-05-18 | SEVERITY: High

**Gejala:** Saat user meminta generate image via Telegram, bot terus menampilkan status `sending photo/upload_photo` sampai beberapa menit dan tidak memberi hasil atau error.
**Root Cause:** Endpoint image generation eksternal dipanggil tanpa timeout/abort dan handler Telegram tool tidak menangkap error per-tool, sehingga proses bisa menggantung sampai runtime mati tanpa feedback ke user.
**Fix:** Tambahkan timeout eksplisit untuk image generation, web search, dan web fetch; bungkus tiap handler tool Telegram dengan fail-fast error handling, log status `failed`, dan kirim pesan gagal yang jelas ke chat.
**Pelajaran:** Semua tool eksternal di chat agent wajib punya timeout, error boundary, dan fallback message. Chat UX tidak boleh menggantung diam-diam karena user menganggap bot/app rusak.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/client.ts`, `src/app/api/webhook/telegram/route.ts`

## BUG-113 | 2026-05-18 | SEVERITY: High

**Gejala:** Setelah image generation macet, chat Telegram biasa seperti pertanyaan agenda hari ini ikut terlihat `typing` terus dan tidak pernah memberi respons.
**Root Cause:** Jalur model utama (`callLLM`) dan vision masih memakai request tanpa timeout, dan webhook Telegram tidak membungkus jalur chat normal dengan error boundary yang mengirim fallback reply.
**Fix:** Tambahkan timeout untuk `callLLM` dan vision extraction, serta bungkus jalur chat normal Telegram dengan catch yang mencatat `ai_hub_logs` status `failed` dan mengirim pesan gagal yang manusiawi.
**Pelajaran:** Timeout harus konsisten di semua jalur AI, bukan hanya tool baru. Satu endpoint lambat tidak boleh membuat chat channel terasa mati.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/client.ts`, `src/app/api/webhook/telegram/route.ts`

## BUG-114 | 2026-05-18 | SEVERITY: High

**Gejala:** Pertanyaan natural seperti `Agenda hari ini` gagal karena tetap dilempar ke model utama, padahal data agenda tersedia langsung di database.
**Root Cause:** Telegram hanya punya shortcut deterministic untuk command slash (`/today`, `/tasks`, `/habits`), sementara bahasa natural lookup harian masuk ke LLM. Saat endpoint model `combo1` menolak koneksi (`ECONNREFUSED`), query praktis ikut gagal.
**Fix:** Tambahkan deterministic natural lookup sebelum jalur AI untuk intent hari ini, task/tugas, dan habit; perbaiki format agenda hari ini dengan jam lokal; perjelas error network dari `fetch failed` menjadi penyebab koneksi.
**Pelajaran:** Agent mode tetap butuh deterministic rails untuk aksi/lookup harian. AI boleh memperkaya, tapi query data utama tidak boleh bergantung penuh pada provider LLM.
**Status:** RESOLVED
**Terkait:** `src/app/api/webhook/telegram/route.ts`, `src/lib/ai/client.ts`

## BUG-115 | 2026-05-18 | SEVERITY: High

**Gejala:** Telegram `/search` dan `/fetch` gagal walaupun endpoint `/v1/search` dan `/v1/web/fetch` tersedia.
**Root Cause:** Endpoint tool membutuhkan field `provider` atau `model`; tanpa provider server fallback ke provider default `cx/gpt-5.5` yang tidak dikenali untuk tool search/fetch. Provider yang aktif untuk endpoint ini adalah `exa`.
**Fix:** Kirim `provider: exa` untuk search dan web fetch, tambahkan env `OPENCODE_SEARCH_PROVIDER` serta `OPENCODE_WEB_FETCH_PROVIDER`, dan perbaiki normalizer agar membaca response `content.text` dari Exa fetch.
**Pelajaran:** Chat model dan tool provider tidak selalu sama. Tooling agent harus punya konfigurasi provider sendiri, bukan menebak dari model utama.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/client.ts`, `.env.example`

## BUG-116 | 2026-05-18 | SEVERITY: High

**Gejala:** User bertanya nilai aktual seperti `kurs dollar hari ini`, tetapi Telegram membalas daftar link/source mentah, bahkan menduplikasi link redirect panjang, bukan angka kurs.
**Root Cause:** Formatter search Telegram mengirim hasil search ke model plus menempel daftar URL mentah lagi di bawah jawaban. Prompt summarizer juga tidak memaksa model mengambil angka dari snippet, sehingga data kurs yang sudah ada di snippet dianggap hanya daftar sumber.
**Fix:** Bersihkan HTML snippet search, simpan `display_url`, hilangkan duplikasi URL mentah dari balasan Telegram, tampilkan sumber sebagai nama/domain pendek, dan perkuat prompt agar angka/kurs/harga di snippet wajib diangkat di awal jawaban.
**Pelajaran:** Tool output bukan jawaban user. Search agent harus mengubah hasil mentah menjadi jawaban praktis: nilai utama dulu, sumber ringkas belakangan.
**Status:** RESOLVED
**Terkait:** `src/lib/ai/client.ts`, `src/app/api/webhook/telegram/route.ts`, `src/app/api/ai/command/route.ts`
