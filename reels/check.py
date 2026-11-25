"""Tes grafis: gambar frame contoh dengan brand.py lalu bandingkan dengan reels/ref/.
Jalankan sebelum kirim preview atau render:  python3 reels/check.py
Setelah Arifin menyetujui perubahan grafis yang SENGAJA:  python3 reels/check.py --update"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand
from brand import hl, grid, dim

REF = Path(__file__).resolve().parent / 'ref'
THRESH = 0.05   # selisih rata-rata maksimal (skala 0-255)

def samples():
    bg = lambda: Image.new('RGB', (brand.W, brand.H), (70, 110, 80))
    out = {}
    im = bg(); y = hl(im, 'TERIMA KASIH WARGA BARU!', y=300, size=84)
    grid(im, [('@' + n, ['p', 'y', 'g', 'o'][i % 4]) for i, n in enumerate(['abcde_1', 'warga.baru', 'pohon_fan', 'desa.kita', 'nama_panjang_sekali_01', 'x'])], y + 30, pw=405, ph=68, gap=10, size=28)
    out['judul_grid'] = im
    im = dim(bg(), .35); y = hl(im, 'JADI WARGA!', y=270, size=110)
    out['judul_besar'] = im
    im = bg(); grid(im, [('FOLLOW = DAPAT RUMAH', 'y'), ('KOMEN = GANTI JOB', 'p'), ('REQUEST BANGUNAN', 'g'), ('LIKES TERBANYAK', 'o')], 600, pw=420, ph=76, size=38)
    out['empat_warna'] = im
    return out

def main():
    update = '--update' in sys.argv; REF.mkdir(exist_ok=True); bad = 0
    for name, im in samples().items():
        f = REF / f'{name}.png'
        if update or not f.exists():
            im.save(f); print('disimpan', f.name); continue
        a = np.asarray(im).astype(int); b = np.asarray(Image.open(f).convert('RGB')).astype(int)
        d = float(np.abs(a - b).mean())
        print(f'{name}: selisih {d:.4f}', 'OK' if d <= THRESH else 'GAGAL'); bad += d > THRESH
    if bad: print('GRAFIS BERUBAH dari acuan. Jangan lanjut sebelum dicek.'); sys.exit(1)
    print('Grafis sesuai acuan.')
main()
