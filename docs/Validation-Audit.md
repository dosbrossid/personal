# 🔍 Validasi Putaran 3: Gap Baru & Saran Tambahan

---

## A. Status Validasi Prinsip Skill Agent (11/11)

| # | Prinsip | Status | Catatan |
|---|---------|--------|---------|
| 1 | Validasi Premis | ✅ | Tercakup di Blueprint §1 |
| 2 | Foundation First | ✅ | Urutan build ada di Blueprint §11 |
| 3 | Plan Detail (5 checklist) | ✅ 5/5 | Semua item terpenuhi |
| 4 | Dokumentasi Bug | ✅ | BUG-HISTORY.md ada di domain structure |
| 5 | Cara Bertanya | ✅ | Prinsip perilaku agent |
| 6 | Data Flow Menyeluruh | ✅ | 4 flow terpetakan di PRD §7 |
| 7 | Hierarki Tech Stack | ✅ | Tercakup di Blueprint §1 |
| 8 | Bangun Karena Butuh | ✅ | Fase 2 ditunda (CRM, Affiliate, Ideation) |
| 9 | Stop & Pahami | ✅ | Prinsip perilaku agent |
| 10 | Keamanan Data (5 checklist) | ✅ 5/5 | Atomic, idempotent, soft delete, audit, server validation |
| 11 | Tech Rekomendasi | ✅ | Supabase RPC dipilih untuk atomicity |

**Semua 11 prinsip sudah terpenuhi.** Tapi saat saya baca lebih mikroskopis, ada hal-hal yang belum tercantum dan berpotensi menjadi masalah saat eksekusi:

---

## B. 8 Gap Baru yang Ditemukan

### Gap 1: 🔴 AI System Prompt Belum Didefinisikan
**Masalah:** Kualitas parsing AI 100% tergantung pada System Prompt. Tapi kita belum menulis satu pun. File `lib/ai/prompts.ts` disebut di domain structure tapi isinya kosong.

**Dampak:** Tanpa prompt yang presisi, AI bisa salah mengkategorikan teks. Contoh: *"RPS Algo"* bisa dianggap catatan biasa, bukan tugas akademik.

**Solusi:** Definisikan system prompt sekarang. AI perlu tahu:
- Daftar `action` yang tersedia: `TASK`, `NOTE`, `CALENDAR`, `ACADEMIC`, `MULTI` (gabungan)
- Daftar `contextual_role` yang valid: `dosen`, `creator`, `affiliate`, `consultant`, `general`
- Daftar `categories` yang *sudah ada* milik user (di-inject dinamis sebelum setiap panggilan)
- Format output JSON yang ketat (schema)
- Instruksi khusus: *"Jika kamu mendeteksi tanggal/waktu, selalu buat CALENDAR entry juga."*

**Contoh System Prompt yang Harus Ditulis:**
```
Kamu adalah asisten pribadi. Tugasmu: mengekstrak perintah user menjadi JSON terstruktur.

ATURAN:
1. Output HANYA JSON, tanpa teks tambahan.
2. Setiap perintah bisa menghasilkan SATU atau BANYAK item sekaligus.
3. Jika mendeteksi tanggal/waktu → buat entry "calendar" + entry "task" jika relevan.
4. Jika kontennya berupa URL → deteksi sumbernya (TikTok, Google Drive, jurnal).
5. Jika tidak ada kategori yang cocok dari daftar kategori user, sarankan nama kategori baru di field "suggested_new_category".

KATEGORI USER SAAT INI: {{dynamic_categories}}
TIMEZONE USER: Asia/Jakarta (UTC+7)

OUTPUT SCHEMA:
{
  "items": [
    {
      "action": "TASK" | "NOTE" | "CALENDAR" | "ACADEMIC",
      "data": {
        "title": "string",
        "description": "string | null",
        "contextual_role": "dosen" | "creator" | "affiliate" | "consultant" | "general",
        "category_name": "string (existing) | null",
        "suggested_new_category": "string | null",
        "due_date": "ISO8601 | null",
        "start_at": "ISO8601 | null",
        "end_at": "ISO8601 | null",
        "priority": "low" | "medium" | "high" | "urgent",
        "source_url": "string | null",
        "reminder_minutes": "number | null"
      }
    }
  ],
  "ai_message": "string - pesan ringkas untuk ditampilkan ke user"
}
```

### Gap 2: 🔴 Single Category vs Multi-Tag
**Masalah:** ERD saat ini menggunakan `category_id FK` (1 kategori per catatan). Tapi di dunia nyata, 1 catatan sering *cross-cutting*. Contoh: *"Ide konten TikTok berdasarkan teori pemasaran digital yang saya ajarkan di kampus"* — ini masuk Affiliate DAN Dosen sekaligus.

**Solusi yang disarankan:** Buat tabel *junction* (many-to-many):

```sql
CREATE TABLE item_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'brain_note' | 'task' | 'academic_vault' | 'calendar_event'
  category_id UUID NOT NULL REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, category_id) -- cegah duplikasi
);
```

**Trade-off:** Lebih fleksibel, tapi query menjadi sedikit lebih kompleks (butuh JOIN). Untuk MVP, *ini sangat layak* karena Anda punya 4 peran yang sering bertumpukan.

**Keputusan dibutuhkan:** Apakah kita pakai `category_id FK` (1 kategori) atau `item_categories` junction table (multi kategori)?

### Gap 3: ⚠️ Telegram Bot Command Structure Belum Ada
**Masalah:** Flow 3 (Telegram Webhook) menyebutkan `/confirm`, tapi bagaimana user berinteraksi dengan bot secara detail?

**Solusi:** Definisikan command list:

| Command | Fungsi |
|---------|--------|
| `/start` | Linking akun — bot mengirim link auth untuk menghubungkan Telegram Chat ID ke akun dashboard |
| `/help` | Daftar perintah |
| `/confirm` | Konfirmasi draft terakhir untuk disimpan |
| `/cancel` | Batalkan draft terakhir |
| `/tasks` | Lihat 5 task terdekat (due date) |
| `/habits` | Lihat status habit hari ini, bisa check-in langsung dengan inline button |
| `/today` | Rangkuman agenda hari ini (calendar + tasks + habits) |
| Teks bebas | Dikirim ke AI parser, respons dikembalikan sebagai draft |

### Gap 4: ⚠️ Timezone Handling Belum Direncanakan
**Masalah:** User di Jakarta (UTC+7). Supabase menyimpan `TIMESTAMPTZ` dalam UTC. Jika AI parsing mendeteksi *"besok jam 10 pagi"*, sistem harus tahu bahwa "besok" = tanggal di timezone Jakarta, bukan UTC.

**Solusi:**
1. Kolom `preferences.timezone` di tabel `users` → default `'Asia/Jakarta'`
2. System prompt ke AI harus include timezone: `TIMEZONE USER: Asia/Jakarta (UTC+7)`
3. Frontend menampilkan semua waktu dalam timezone lokal user (library `date-fns-tz` atau `dayjs` dengan plugin timezone)
4. Semua kalkulasi filter waktu harus timezone-aware:
```sql
-- BENAR: Filter "hari ini" di Jakarta
WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta')
  AND created_at < (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta') + interval '1 day'
```

### Gap 5: ⚠️ Supabase Storage Limit (Free Tier = 1GB)
**Masalah:** Free tier Supabase Storage hanya 1GB. Dengan upload PDF RPS, jurnal, dan JPG, ini bisa penuh dalam beberapa bulan.

**Solusi:**
1. Tampilkan **Storage Usage Widget** di Settings (query `file_size_bytes` dari `academic_vault` + attachment files)
2. Kompresi JPG di client-side sebelum upload (target < 500KB)
3. Untuk file besar (> 5MB), **sarankan user gunakan Google Drive link** sebagai alternatif
4. Dokumentasikan limit ini di onboarding

### Gap 6: ⚠️ Vercel Cron Limit (Free Tier)
**Masalah:** Vercel Free tier **hanya 1 cron job** dan **minimum interval 1 hari** (bukan per menit!). Hobby plan baru support cron per jam. Pro plan untuk per menit.

**Dampak:** Notifikasi `notification_queue` yang dijadwalkan per menit TIDAK BISA jalan di free tier.

**Alternatif Solusi:**
| Opsi | Kelebihan | Kekurangan |
|------|-----------|------------|
| Vercel Pro ($20/bln) | Cron per menit, native | Biaya |
| Supabase Edge Functions + pg_cron | Gratis, built-in PostgreSQL | Setup lebih kompleks |
| External cron (cron-job.org) | Gratis, hit endpoint kita setiap menit | Dependency external |

**Rekomendasi:** Gunakan **Supabase `pg_cron`** (gratis, sudah ada di infrastruktur kita). Atau untuk MVP, gunakan external cron service yang hit `/api/cron/notifications` setiap 5 menit.

### Gap 7: ⚠️ Onboarding Flow Belum Ada
**Masalah:** Bagaimana user pertama kali masuk? Menghubungkan Telegram? Membuat kategori awal?

**Solusi:** Buat flow sederhana:

```
Login pertama kali
      │
      ▼
[Halaman Onboarding - 3 langkah]

Step 1: "Selamat datang! Pilih peran Anda" 
→ Checklist: ☑ Dosen ☑ Creator ☑ Affiliate ☑ Consultant
→ Sistem auto-create default categories per role yang dipilih

Step 2: "Hubungkan Telegram (Opsional)"
→ Tampilkan QR code / link ke @YourBot
→ User /start di Telegram → bot kirim kode OTP
→ User input kode di dashboard → linked!

Step 3: "Selesai! Mulai dengan mengetik perintah pertamamu."
→ Redirect ke AI Hub
```

### Gap 8: ⚠️ Dashboard Home Widget Spec Belum Ada
**Masalah:** PRD menyebut "Bento Grid" dan "1 layar" tapi tidak mendefinisikan widget apa saja yang tampil di home.

**Solusi — Home Dashboard Widgets:**

```
┌─────────────────────────────────────────────────┐
│  AI Command Hub (Chat Input — selalu di atas)   │
├──────────────────┬──────────────────────────────┤
│                  │                              │
│  📋 Tasks Today  │  📅 Agenda Hari Ini          │
│  (5 task teratas)│  (Calendar events hari ini)  │
│                  │                              │
├──────────────────┼──────────────────────────────┤
│                  │                              │
│  🔥 Habit Matrix │  🧠 Recent Notes             │
│  (7-hari grid)   │  (5 catatan terbaru)         │
│                  │                              │
├──────────────────┴──────────────────────────────┤
│  🔔 Notifikasi Terbaru (3 item)                 │
└─────────────────────────────────────────────────┘
```

Setiap widget = 1 SWR hook terpisah. Load independently. Gagal satu, sisanya tetap muncul.

---

## C. Saran Tambahan (Nice-to-Have, Bukan Blocker)

Ini BUKAN untuk dibangun sekarang. Hanya dicatat agar arsitektur kita tidak menutup pintu jika nanti dibutuhkan:

| # | Saran | Alasan | Prioritas |
|---|-------|--------|-----------|
| 1 | **Weekly AI Digest** | Setiap Senin pagi, AI merangkum: *"Minggu lalu Anda mencatat 12 ide, menyelesaikan 8 task, dan melewatkan 2 habit."* Dikirim via Telegram. | Fase 2 |
| 2 | **Quick Capture Browser Extension** | Saat browsing dan menemukan sesuatu menarik, klik 1 tombol → langsung masuk ke brain_notes tanpa buka dashboard. | Fase 2 |
| 3 | **Voice Input** | Saat berkendara atau jalan, rekam suara → Whisper API transkripsi → masuk ke AI parser. | Fase 3 |
| 4 | **Note Linking (Zettelkasten)** | Catatan A bisa di-link ke Catatan B, membentuk graph pengetahuan. Tabel tambahan: `note_links (source_id, target_id)`. | Fase 3 |
| 5 | **Export ke Notion/Obsidian** | Banyak knowledge worker yang ingin backup second brain mereka ke format standar (Markdown). | Fase 2 |
| 6 | **AI Usage Tracking** | Catat berapa kali API Opencode Go dipanggil per hari + estimasi biaya. Tampilkan di Settings. | Fase 1 (kecil) |

---

## D. Keputusan yang Dibutuhkan Sebelum Coding

| # | Pertanyaan | Opsi | Dampak |
|---|-----------|------|--------|
| 1 | **Single category atau multi-category?** | A: `category_id` FK (1:1, simpel) — B: `item_categories` junction (N:N, fleksibel) | ERD berubah jika pilih B |
| 2 | **Cron strategy?** | A: Vercel Pro ($20/bln) — B: Supabase pg_cron (gratis) — C: External cron (gratis) | Arsitektur notifikasi berubah |
| 3 | **Apakah AI Usage Tracking masuk MVP?** | Ya / Tidak | Jika ya, perlu tabel `ai_usage_logs` |
| 4 | **Apakah Onboarding default categories perlu?** | Ya → AI langsung punya konteks — Tidak → User mulai dari nol | UX first-time user |

> [!IMPORTANT]
> Kesimpulan: Kedua dokumen (PRD & Blueprint) secara arsitektural sudah **sangat solid** untuk dieksekusi. 8 gap di atas bersifat *refinement* (penghalusan), bukan cacat struktural. 4 keputusan di atas perlu dijawab agar saya bisa memperbarui ERD dan langsung mulai menulis kode.
