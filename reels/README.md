# reels/

- `brand.py`  grafis terkunci (warna, font, judul, pill, grid). Satu-satunya tempat gaya didefinisikan.
- `anim.py`   mesin animasi (pop/slide/rise) + render ke mp4 lewat ffmpeg.
- `scenes_day5.py`  scene Day 5 sebagai contoh bentuk template. Jalankan: `python3 reels/scenes_day5.py thanks|cta|job|kunjung|pill|det` (hasil di `reels/out/`).
- `check.py`  tes grafis terhadap `reels/ref/`.
- `fonts/`, `assets/day5/`  font (Inter Display Black, Poppins Bold, Noto Color Emoji; semuanya lisensi terbuka) dan latar Day 5.

Butuh: Python 3, `pip install pillow numpy`, dan `ffmpeg`.
