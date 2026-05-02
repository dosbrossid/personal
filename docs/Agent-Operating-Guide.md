# Agent Operating Guide

Panduan ini menjelaskan cara AI coding agent harus bekerja di project ini mengikuti gaya owner: cepat ship, banyak validasi nyata, tapi tetap punya catatan dan guardrail.

## Cara Membaca Request Owner

Owner sering memberi request dalam bentuk natural dan cepat. Agent harus mengklasifikasikan request sebelum bertindak:

| Sinyal Owner                                                 | Kategori      | File Tracking                                                         |
| ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------- |
| "bug", "error", "gak jalan", screenshot perilaku salah       | Bug/Hotfix    | `BUG-HISTORY.md` dan `PRODUCT-INBOX.md` jika perlu                    |
| "menurutku kurang nyaman", "font kecil", "warna kurang enak" | UX Polish     | `PRODUCT-INBOX.md`                                                    |
| "coba sarankan", "gimana cara sempurnakan"                   | Product Idea  | `PRODUCT-INBOX.md`                                                    |
| "samakan logika", "hybrid deterministic", "memory/cache"     | Architecture  | `PRODUCT-INBOX.md` dan dokumen terkait                                |
| "push"                                                       | Git Operation | Tidak perlu file tracking baru, kecuali ada perubahan kode sebelumnya |

## File yang Wajib Diupdate

### `BUG-HISTORY.md`

Update jika ada bug nyata atau regression.

Format:

```markdown
## BUG-XXX | YYYY-MM-DD | SEVERITY: Critical/High/Medium/Low

**Gejala:**
**Root Cause:**
**Fix:**
**Pelajaran:**
**Status:** OPEN / RESOLVED
**Terkait:**
```

Aturan:

- Buat entry sebelum atau saat fix, jangan setelah lupa konteks.
- Jika root cause belum pasti, tulis `Root Cause: Investigating`.
- Saat fix selesai, update status ke `RESOLVED`.

### `PRODUCT-INBOX.md`

Update setiap owner memberi:

- Komplain UX.
- Ide fitur.
- Permintaan refinement.
- Observasi produk yang belum langsung dikerjakan.
- Keputusan produk/architecture yang penting.

Jangan terlalu panjang. Satu item harus cukup untuk mengingat konteks.

### Dokumen Modul di `docs/`

Update jika perubahan mengubah arah fitur besar:

- Blog/editor/public blog: update dokumen blog jika perlu.
- AI command hub/Telegram/chat bubble: buat atau update dokumen AI terkait jika sudah ada.
- Class management: update `docs/Class-Management-Plan.md`.
- Backend/data flow: update backend plan atau architecture docs.

## Ritual Kerja Agent

### 1. Intake

Saat owner mengeluh atau memberi ide:

- Ringkas pemahaman dalam 1-2 kalimat.
- Catat item di `PRODUCT-INBOX.md`.
- Jika bug, catat juga di `BUG-HISTORY.md`.
- Baru mulai eksplorasi kode.

### 2. Exploration

Agent harus:

- Cari source of truth di kode.
- Bandingkan flow create/edit/read.
- Cek apakah bug terjadi di UI, server action, API route, Supabase query, cache SWR, atau external bot.

### 3. Implementation

Agent harus:

- Fix di level paling tepat.
- Jangan hanya tambal UI jika kontrak server juga salah.
- Jangan menambah dependency kecuali ada izin owner atau trade-off jelas.
- Pertahankan UX natural yang disukai owner, khususnya chat bubble dan blog writing flow.

### 4. Verification

Minimal:

- Lint file terkait.
- Build penuh jika menyentuh Next route, dependency, editor, auth, AI, public blog, atau data model.
- Jelaskan kalau verifikasi manual belum dilakukan.

### 5. Closeout

Final response wajib singkat dan jelas:

- Apa yang berubah.
- Apa yang sudah dites.
- Apakah ada migration/env/dependency.
- Apakah sudah push atau belum.
- Risiko tersisa kalau ada.

## Escalation Rules

Agent harus berhenti dan minta konfirmasi jika:

- Perlu migration database yang bisa mengubah data existing.
- Perlu dependency besar dan belum ada izin.
- Perlu menghapus fitur yang sudah dipakai owner.
- Ada conflict dengan perubahan user di working tree.
- Fix kecil ternyata butuh refactor luas.

Agent boleh langsung jalan tanpa bertanya jika:

- Bug jelas dan fix lokal.
- UX polish kecil.
- Dokumentasi/tracking update.
- Build/lint untuk verifikasi.

## Standar Kualitas Khusus

### Blog Publik

Target:

- Lighthouse hijau.
- Readability nyaman di mobile.
- Gambar WebP/compressed.
- SSR tetap crawlable.

Jangan:

- Tambah script berat di public blog tanpa alasan kuat.
- Mengorbankan readability demi efek visual.

### Blog Editor

Target:

- Writing flow natural.
- Create dan edit punya behavior sama.
- Selection tidak hilang saat toolbar dipakai.
- Formatting bisa dibersihkan.
- Save-edit-render harus idempotent.

### AI Command Hub

Target:

- Hybrid deterministic: AI boleh fleksibel, executor tetap aman.
- Chat bubble dan Telegram memakai logika yang konsisten.
- AI boleh mengambil konteks relevan, tapi action penting tetap structured/confirmable.
