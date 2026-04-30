# Shipping Workflow - Personal Dashboard

Dokumen ini dibuat untuk menjaga gaya kerja owner tetap cepat: build MVP, pakai sendiri, rasakan gesekan, lalu improve. Tujuannya bukan membuat proses jadi berat, tapi memberi rel pengaman supaya perubahan cepat tidak bikin produk rapuh.

## Prinsip Kerja

1. **Ship kecil, sering, dan nyata.**
   Perubahan kecil yang langsung bisa dipakai lebih bernilai daripada rencana besar yang lama tidak disentuh.

2. **Bug dari pemakaian nyata lebih penting daripada spekulasi.**
   Kalau owner menemukan friction saat memakai dashboard, itu sinyal produk. Tangkap dulu, baru putuskan fix sekarang atau masuk backlog.

3. **Jangan campur semua jenis kerja.**
   Hotfix, polish UX, dan architecture upgrade harus dipisah agar satu perbaikan kecil tidak berubah jadi refactor liar.

4. **AI agent wajib jadi QA pair.**
   Owner tidak harus mengingat semua checklist. Agent harus membaca konteks, mencatat bug/ide, menjalankan verifikasi, dan menjaga agar kerja tetap rapi.

## Mode Kerja

### 1. Hotfix

Gunakan saat fitur harian rusak, data salah, save gagal, AI bot ngawur, atau UX menghambat pemakaian langsung.

Kriteria:
- Dampak terasa saat dipakai sekarang.
- Fix bisa dibuat tanpa menunda fitur lain terlalu lama.
- Wajib dicatat di `BUG-HISTORY.md`.

Minimal done:
- Root cause dipahami.
- Fix dibuat di source yang benar.
- Build/lint relevan hijau.
- Jika ada data flow, cek SWR mutate/server action/API route.

### 2. Polish UX

Gunakan untuk font, spacing, warna, layout, empty state, microcopy, dan workflow yang terasa kurang nyaman tapi tidak menghentikan kerja.

Kriteria:
- Boleh dibatch 2-5 item kecil.
- Tidak boleh menambah dependency kecuali jelas meningkatkan UX dan disetujui owner.
- Untuk public blog, tetap jaga Lighthouse dan readability.

Minimal done:
- Desktop dan mobile dipikirkan.
- Tidak merusak flow utama.
- Build/lint relevan hijau.

### 3. Architecture Upgrade

Gunakan untuk perubahan fondasi seperti AI command hub, memory/cache, editor blog, image pipeline, atau auth/data architecture.

Kriteria:
- Perubahan punya risiko luas.
- Agent wajib jelaskan trade-off singkat sebelum eksekusi kalau ada pilihan signifikan.
- Perlu dokumen keputusan singkat di `PRODUCT-INBOX.md` atau dokumen terkait.

Minimal done:
- Backward compatibility dipikirkan.
- Tidak ada migration tersembunyi tanpa diberitahu owner.
- Build penuh hijau.
- Catat risiko/residual issue di final response.

## Checklist Cepat Owner

Pakai ini saat mengetes fitur secara manual:

- **Buat baru:** bisa create data/artikel/event/task?
- **Edit ulang:** data lama bisa dibuka, diubah, lalu disimpan?
- **Persist:** refresh halaman, data tetap benar?
- **Mobile:** ukuran, spacing, dan tombol masih nyaman?
- **AI path:** chat bubble dan Telegram konsisten kalau fiturnya terkait AI?
- **Public path:** kalau terkait blog publik, halaman tetap cepat dan nyaman dibaca?

## Checklist Cepat Agent

Sebelum coding:
- Baca file terkait, jangan asumsi.
- Cek apakah request adalah bug, ide, polish, atau architecture.
- Update file tracking yang sesuai.

Saat coding:
- Jangan revert perubahan user.
- Jangan tambah dependency tanpa izin eksplisit.
- Untuk bug, catat di `BUG-HISTORY.md`.
- Untuk ide/complaint, catat di `PRODUCT-INBOX.md`.

Sebelum selesai:
- Jalankan lint/build sesuai dampak perubahan.
- Sebutkan apa yang diuji.
- Sebutkan kalau ada migration, env, atau dependency baru.
- Kalau user minta push, commit dan push setelah verifikasi.

## Definition of Done Singkat

Sebuah perubahan dianggap selesai kalau:

- Perilaku inti bekerja.
- Data tersimpan/terbaca benar.
- UX utama tidak regression di mobile.
- Build/lint relevan hijau.
- Tracking file sudah diupdate.
- Status akhir jelas: pushed atau belum pushed.

