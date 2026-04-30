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
| PI-004 | 2026-04-30 | UX Polish | P2 | DONE | Public Blog | Margin kiri-kanan blog post setelah `px-6` terasa terlalu jauh; perlu dikurangi sedikit. | Follow-up owner setelah melihat deploy/preview spacing. | `src/app/public-blog/blog/[slug]/page.tsx` |
| PI-005 | 2026-04-30 | UX Polish | P2 | DONE | Public Blog | Finalisasi gutter blog post mobile ke titik tengah ala Medium: `px-5`, tidak terlalu mepet dan tidak terlalu jauh. | Kesimpulan dari perbandingan screenshot + DOM Medium. | `src/app/public-blog/blog/[slug]/page.tsx` |
| PI-006 | 2026-04-30 | UX Polish | P2 | DONE | Public Blog | Gutter `px-5` masih terasa terlalu besar; kembalikan ke `px-4` dan turunkan body serta excerpt 1px. | Follow-up owner setelah preview mobile. | `src/app/public-blog/blog/[slug]/page.tsx` |
| PI-007 | 2026-04-30 | Architecture Upgrade | P1 | DONE | PWA | Selesaikan PWA agar installable, punya offline fallback, service worker update flow, dan cache strategy yang aman untuk dashboard pribadi. | Request owner: "sekarang selesaikan implementasi PWAnya dong". | `src/app/manifest.ts`, `public/sw.js`, `src/components/providers/PWAProvider.tsx` |
| PI-008 | 2026-04-30 | UX Polish | P1 | DONE | Public Blog | Samakan body artikel ke `18px/28px`, excerpt ke `18px/24px`, dan kurangi padding kiri-kanan artikel. | Owner memberi spesifikasi computed style Medium untuk body dan excerpt. | `src/app/public-blog/blog/[slug]/page.tsx` |
| PI-009 | 2026-04-30 | UX Polish | P1 | DONE | PWA | Install prompt PWA tidak terlihat; perlu fallback toast instruksi install saat browser tidak memicu native prompt. | Follow-up owner setelah implementasi PWA. | `src/components/providers/PWAProvider.tsx` |
| PI-010 | 2026-04-30 | Bug | P1 | DONE | PWA | PWA yang sudah diinstall masih terbuka seperti browser; hindari fallback Android yang membuat shortcut non-standalone dan perkuat manifest icon eligibility. | Follow-up owner: PWA installed tapi tidak seperti native app. | `src/components/providers/PWAProvider.tsx`, `src/app/manifest.ts` |
| PI-011 | 2026-04-30 | UX Polish | P2 | DONE | Public Blog | Samakan favicon public blog dengan icon PWA/dashboard agar branding konsisten di tab browser dan mobile. | Request owner setelah PWA polish. | `src/app/layout.tsx`, `src/app/public-blog/layout.tsx` |
