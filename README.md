# Personal Dashboard

Personal productivity dashboard berbasis `Next.js + Supabase` untuk workflow harian owner: task, agenda, catatan, habit, vault, AI command, notifikasi, dan integrasi Telegram.

## Local Development

Jalankan server lokal:

```bash
npm install
npm run dev
```

App akan tersedia di [http://localhost:3000](http://localhost:3000).

## Environment

Project ini butuh `.env.local` yang minimal memuat:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Contoh awal tersedia di `.env.example`.

## Scheduler Notifications

Project ini **tidak lagi memakai Vercel Cron** untuk dispatch notifikasi, karena Vercel Hobby hanya mengizinkan cron harian.

Scheduler yang dipakai sekarang:

- Hosting endpoint: `Vercel`
- Scheduler: `Supabase pg_cron`
- Endpoint dispatch: `/api/cron/notifications`

### Setup Supabase Cron

1. Pastikan `pg_cron`, `pg_net`, dan Vault aktif di project Supabase.
2. Simpan secret berikut di Supabase Vault:
   - `personal_dashboard_project_url`
   - `personal_dashboard_cron_secret`
3. Pastikan `personal_dashboard_cron_secret` nilainya sama dengan `CRON_SECRET` di Vercel.
4. Jalankan script:

```sql
-- file:
-- supabase/scripts/006_schedule_notifications_via_supabase_cron.sql
```

File SQL siap pakai ada di `supabase/scripts/006_schedule_notifications_via_supabase_cron.sql`.

Secara default script itu menjadwalkan dispatch setiap `5 menit`.

Kalau sebelumnya kamu mendapat error `schema "cron" does not exist`, itu berarti `pg_cron` belum aktif. Script terbaru sekarang akan mencoba mengaktifkan `pg_cron` dan `pg_net` otomatis, lalu akan memberi error yang lebih jelas kalau `Vault` belum tersedia.

## Database

Schema dan helper SQL utama ada di:

- `supabase/migrations`
- `supabase/scripts`

Untuk rebuild manual public schema, gunakan:

- `supabase/scripts/001_rebuild_public_schema.sql`

## Notes

- Endpoint `/api/cron/notifications` menerima `GET` dan `POST`
- Auth scheduler memakai `Authorization: Bearer <CRON_SECRET>` atau `?secret=...`
- Rich text ringan untuk notes mendukung bold, italic, bullet, dan numbering langsung di editor
