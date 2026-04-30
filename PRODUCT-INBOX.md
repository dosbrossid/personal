# Product Inbox

Inbox ringan untuk menangkap komplain, ide, polish, dan keputusan produk dari owner. File ini menjaga gaya kerja tetap cepat tanpa kehilangan konteks.

## Cara Pakai

Agent wajib menambahkan item baru ketika owner:
- Mengeluh UX atau behavior produk.
- Memberi ide fitur.
- Mengubah prioritas.
- Memberi feedback setelah mencoba hasil deploy/local.
- Meminta audit atau refinement yang belum langsung selesai.

Jika item sudah dikerjakan:
- Ubah status ke `DONE`.
- Tambahkan link commit bila sudah ada.
- Jika berubah menjadi bug resmi, tambahkan referensi `BUG-XXX`.

## Status

| Status | Arti |
|---|---|
| `NEW` | Baru dicatat, belum dipilah |
| `NEXT` | Layak dikerjakan segera |
| `DOING` | Sedang dikerjakan |
| `DONE` | Sudah selesai |
| `PARKED` | Ditunda sadar, bukan hilang |

## Priority

| Priority | Arti |
|---|---|
| `P0` | Menghambat pemakaian utama / data salah |
| `P1` | Sangat terasa di UX harian |
| `P2` | Improvement penting tapi tidak blocking |
| `P3` | Nice-to-have |

## Inbox

| ID | Date | Type | Priority | Status | Area | Summary | Source / Notes | Linked |
|---|---|---|---|---|---|---|---|---|
| PI-001 | 2026-04-30 | Process | P1 | DONE | Workflow | Owner ingin sistem kerja ship-fast yang tetap punya dokumentasi, bug/idea tracking, dan panduan agent. | Dibuat setelah diskusi gaya kerja MVP -> test -> improve. | `docs/Shipping-Workflow.md`, `docs/Agent-Operating-Guide.md` |
| PI-002 | 2026-04-30 | UX Polish | P1 | DONE | Public Blog | Body artikel mobile terlalu besar dan terlalu lega dibanding Medium; perlu ritme font, line-height, dan paragraph gap yang lebih enak dibaca. | Referensi screenshot Medium mobile vs blog zmaula mobile. | `src/app/public-blog/blog/[slug]/page.tsx` |
| PI-003 | 2026-04-30 | UX Polish | P2 | DONE | Public Blog | Blog post butuh sedikit whitespace kiri-kanan agar teks mobile lebih nyaman dibaca. | Feedback owner setelah tuning ritme body artikel. | `src/app/public-blog/blog/[slug]/page.tsx` |
