# Pohon Warga: aturan untuk Claude (baca sebelum mengerjakan apa pun)

Akun Instagram @pohonwarga. Pemilik: Arifin. Rencana lengkap: dokumen "Daily Post Pohon Warga".

## Aturan wajib
- Balas dalam bahasa Indonesia. Sebut diri "saya", jangan pernah "gue".
- Jujur dan kritis: beri rekomendasi dan jalan keluar, jangan hanya menurut.
- Jangan push ke `main` tanpa persetujuan eksplisit Arifin. Kerjakan di branch. Workflow GitHub aktif (Pages, balasan komentar), jadi push ke `main` punya efek nyata.
- Jangan pernah menandai konten sebagai AI saat menjadwalkan atau memposting.
- Fakta harus dicek (username, jumlah, job, likes) dari file data, bukan perkiraan.
- Pilih opsi yang paling hemat kuota Claude, dan sarankan bila ada yang lebih ringan.

## Video harian (reels)
- Jangan render sebelum storyboard, naskah VO, dan gambar final SEMUA scene disetujui Arifin.
- Setiap menyebut usulan teratas, tampilkan jumlah likes-nya (di balasan dan di scene video).
- Berikan naskah VO dengan tag emosi ElevenLabs, siap salin, untuk durasi 30-35 detik.
- Animasi seperti video hari sebelumnya (pop / slide / rise berurutan).

## Grafis dikunci (jangan menggambar ulang)
- Semua grafis memakai `reels/brand.py` (judul kuning outline ungu, pill 4 warna, grid 2 kolom) dan mesin animasi `reels/anim.py`.
- Dilarang mengubah warna, font, outline, ukuran pill, atau safe zone di luar `brand.py`.
- Safe zone: atas 260 px, bawah 440 px, kanan 160 px harus kosong dari konten penting. Ukuran 1080x1920, 30 fps.
- Sebelum menunjukkan preview atau merender: `python3 reels/check.py` harus lulus. Jika gagal, jangan lanjut.
- Perubahan grafis yang disengaja hanya setelah Arifin setuju, lalu `python3 reels/check.py --update`.
- Contoh bentuk scene yang sudah disetujui: `reels/scenes_day5.py` (aset di `reels/assets/day5/`).

## Format harian (31 detik)
Hook 2 dtk, hasil vote 5, warga baru 7, drama 8, pilihan A/B 5, CTA 4. Detail dan template VO ada di dokumen rencana.
