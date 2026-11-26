"""Buat paket preview harian dari data hari ini (TIDAK render video, TIDAK posting).

Pakai:
  python3 reels/make_day.py --day 5 --followers reels/assets/day5/followers_baru.txt
  python3 reels/make_day.py --day 5 --followers ... --drama reels/story/drama_hari5.json

Keluaran di reels/out/day<N>/: scene_*.png, index.html, vo.txt, caption.txt, veo_prompt.txt, check.json
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand
from brand import hl, grid, dim, load

ROOT = Path(__file__).resolve().parents[1]
DAYS = ROOT / 'site' / 'data' / 'days.json'
GOAL = 300
PER_PAGE = 21
DEFAULT_DRAMA = {   # contoh; WAJIB diganti dengan drama hari itu sebelum disetujui (dicatat di check.json)
    'hook': 'Ada yang tidak beres di desa...',
    'drama1': 'Sesuatu mengintai dari balik kabut.',
    'drama2': 'Kalian yang tentukan langkah berikutnya.',
    'pilihan_a': 'Bertahan di tembok',
    'pilihan_b': 'Serang duluan',
}

def load_followers(path):
    p = Path(path)
    if not p.exists(): sys.exit(f'File follower tidak ada: {p}')
    return [l.strip().lstrip('@') for l in p.read_text(encoding='utf8').splitlines() if l.strip() and not l.startswith('#')]

def get_day(n):
    rec = [d for d in json.loads(DAYS.read_text(encoding='utf8')) if d.get('day') == n]
    if not rec: sys.exit(f'Hari {n} tidak ada di {DAYS}')
    return rec[0]

def scene_bg(d, key=None):
    k = ROOT / 'reels' / 'assets' / f'day{d["day"]}' / f'bg_{key}.png'
    if key and k.exists(): return load(k)
    p = ROOT / 'site' / 'data' / f'shot_day{d["day"]}.png'          # rekaman viewer hari itu (jika ada)
    fallback = Path(__file__).resolve().parent / 'assets' / 'day5' / 'c_wide_full.png'
    return load(p if p.exists() else fallback)

def build_scenes(d, names, drama, n):
    out = {}
    usul = d.get('usul_teratas') or {}
    user, likes = usul.get('user', '-'), int(usul.get('likes', 0))
    bname = (usul.get('text') or 'USULAN').upper()[:40]
    im = dim(scene_bg(d, 'drama'), .35); hl(im, drama['hook'].upper(), y=520, size=96); out['1_hook'] = im
    im = dim(scene_bg(d, 'vote'), .2); y = hl(im, 'KALIAN YANG PILIH!', y=270, size=96)
    grid(im, [(f'@{user} · {likes} LIKE', 'o'), (bname, 'y')], y + 40, cols=1, pw=700, ph=92, size=40)
    out['2_vote'] = im
    pages = [names[i:i + PER_PAGE] for i in range(0, len(names), PER_PAGE)] or [[]]
    cols = ['p', 'y', 'g', 'o']
    for pi, pg in enumerate(pages[:3], 1):      # maks 3 halaman, sama seperti Day 5
        im = dim(scene_bg(d, 'kota'), .2); y = hl(im, f'+{len(names)} WARGA BARU!' + (f' ({pi}/{len(pages)})' if len(pages) > 1 else ''), y=280, size=84)
        grid(im, [('@' + nm, cols[(i // 2 + i % 2) % 4]) for i, nm in enumerate(pg)], y + 30, pw=405, ph=68, gap=10, size=28)
        out[f'3_warga_{pi}'] = im
    im = dim(scene_bg(d, 'drama'), .4); y = hl(im, drama['drama1'].upper(), y=520, size=88)
    hl(im, drama['drama2'].upper(), y=y + 120, size=88); out['4_drama'] = im
    im = dim(scene_bg(d, 'drama'), .3); y = hl(im, 'KOMEN A ATAU B!', y=300, size=96)
    grid(im, [('A: ' + drama['pilihan_a'], 'g'), ('B: ' + drama['pilihan_b'], 'o')], y + 40, cols=1, pw=760, ph=100, size=40)
    out['5_pilihan'] = im
    im = dim(scene_bg(d, 'kota2'), .35); y = hl(im, 'JADI WARGA!', y=260, size=110)
    grid(im, [('FOLLOW = DAPAT RUMAH', 'y'), ('KOMEN = GANTI JOB', 'p'), ('KOMEN = REQUEST BANGUNAN', 'g'), ('LIKES TERBANYAK = DIBANGUN!', 'o')], y + 40, cols=1, pw=820, ph=100, size=36)
    c = brand.counter_img(n, GOAL); im.paste(c.convert('RGB'), ((1080 - 340) // 2, 1360), c)
    out['6_cta'] = im
    return out, pages, usul

def write_vo(d, names, drama, n, path):
    usul = d.get('usul_teratas') or {}
    top3 = ', '.join('@' + x for x in names[:3]) or '-'
    vo = (f"[dramatic] {drama['hook']}\n"
          f"[excited] Kalian yang pilih! Usul terpopuler dari @{usul.get('user', '-')}: {usul.get('text', '')}. Dengan {usul.get('likes', 0)} like, resmi dibangun!\n[pause]\n"
          f"[warmly] Selamat datang {len(names)} warga baru! Ada {top3}, dan banyak lagi. Cari namamu!\n[pause]\n"
          f"[whispers] {drama['drama1']} [pause] [dramatic] {drama['drama2']}\n[pause]\n"
          f"[excited] Sekarang kalian yang tentukan. A: {drama['pilihan_a']}. Atau B: {drama['pilihan_b']}? Komen sekarang!\n[pause]\n"
          f"[cheerful] Follow, dapat rumah. Komen, kamu ikut menentukan. Sisa {max(GOAL - n, 0)} warga lagi, perang dimulai!\n")
    path.write_text(vo, encoding='utf8')
    return len(vo.replace('[pause]', '').split())

def write_caption(d, names, path):
    usul = d.get('usul_teratas') or {}
    path.write_text(f"Hari {d['day']} Pohon Warga\n\n"
                    f"Usul terpopuler dari @{usul.get('user', '-')}: {usul.get('text', '')} ({usul.get('likes', 0)} like)\n"
                    f"Warga baru: {len(names)}\n\n"
                    "Follow = dapat rumah. Komen = minta bangunan atau pilih job.\n"
                    "Usul yang paling banyak di-like dibangun duluan.\n\n#pohonwarga #desaapung #lowpoly", encoding='utf8')

VEO = """Start frame: shot_day<N>.png (rekaman viewer), kota kastil medieval low-poly, siang cerah, objek utama di tengah frame.
Aksi: [isi drama harian, satu kalimat].
Kamera: dolly pelan mendekat ke objek utama, lalu berhenti.
Akhir klip: [isi akhir yang jelas].
Gaya: pertahankan gaya low-poly, warna, bangunan, dan tata letak persis seperti start frame. Jangan menambah bangunan baru. Tanpa teks, tanpa tulisan, tanpa logo. Rasio 9:16.
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--day', type=int, required=True)
    ap.add_argument('--followers', required=True, help='file teks, satu username per baris')
    ap.add_argument('--usul', help='timpa usulan teratas: user|teks|likes|building')
    ap.add_argument('--drama', help='JSON: hook, drama1, drama2, pilihan_a, pilihan_b')
    a = ap.parse_args()
    d = get_day(a.day); names = load_followers(a.followers)
    if a.usul:
        u, t, l = a.usul.split('|')[:3]; d['usul_teratas'] = {'user': u, 'text': t, 'likes': int(l)}
    drama = dict(DEFAULT_DRAMA)
    if a.drama: drama.update(json.loads(Path(a.drama).read_text(encoding='utf8')))
    n = int(d.get('stats', {}).get('population', 0))
    out = ROOT / 'reels' / 'out' / f'day{a.day}'; out.mkdir(parents=True, exist_ok=True)
    scenes, pages, usul = build_scenes(d, names, drama, n)
    files = []
    for k, im in scenes.items():
        im.save(out / f'scene_{k}.png'); files.append(f'scene_{k}.png')
    words = write_vo(d, names, drama, n, out / 'vo.txt')
    write_caption(d, names, out / 'caption.txt')
    (out / 'veo_prompt.txt').write_text(VEO, encoding='utf8')
    warn = []
    if not a.drama: warn.append('masih memakai naskah drama contoh, wajib diganti')
    if len(pages) > 3: warn.append(f'daftar warga {len(names)} lebih dari 3 halaman: hanya 3 halaman yang dibuat')
    (out / 'check.json').write_text(json.dumps({
        'hari': a.day, 'warga_baru': len(names), 'usul_teratas': usul, 'populasi': n,
        'sisa_ke_300': max(GOAL - n, 0), 'kata_vo': words, 'perkiraan_detik_vo': round(words / 2.5, 1),
        'peringatan': warn}, ensure_ascii=False, indent=2), encoding='utf8')
    rows = ''.join(f'<h3>{f}</h3><img src="{f}" style="width:100%;max-width:360px">' for f in files)
    (out / 'index.html').write_text(f'<!doctype html><meta charset="utf8"><title>Preview Day {a.day}</title><body style="font-family:sans-serif">{rows}</body>', encoding='utf8')
    print(f'Selesai: {out} ({len(files)} scene, {words} kata VO)')

if __name__ == '__main__':
    main()
