"""Preview final format hook baru (dikunci 26 Nov, Day 6). Hanya preview gambar, TIDAK render video.
Pakai: python3 reels/make_hook_day.py   (Day 6 hardcoded di CFG; ubah CFG untuk hari lain)"""
import math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand
from brand import hl, pill, grid, dim, load, W, H, YEL, PURP, WHITE, PF, HF, CANVAS_W

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / 'reels' / 'assets' / 'day6'
OUT = ROOT / 'reels' / 'out' / 'day6_v2'; OUT.mkdir(parents=True, exist_ok=True)
CFG = dict(pop=291, sisa=9, baru=7, usul='Sekolah Mage', user='mas.brayennn', likes=3, names=['sriwulandari60887', 'tadano_nabigeta'])

def black():
    im = Image.new('RGB', (W, H), (8, 6, 14)); return im

def crack(im, n=9, seed=3, glow=(150, 70, 255)):
    rnd = random.Random(seed); lay = Image.new('RGB', im.size, (0, 0, 0)); d = ImageDraw.Draw(lay)
    cx, cy = CANVAS_W // 2, 860
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); x, y = cx, cy
        for s in range(7):
            a += rnd.uniform(-.5, .5); l = rnd.uniform(60, 150)
            nx, ny = x + math.cos(a) * l, y + math.sin(a) * l
            d.line([x, y, nx, ny], fill=glow, width=max(2, 9 - s)); x, y = nx, ny
    g = lay.filter(ImageFilter.GaussianBlur(14)); out = Image.blend(im, im, 0)
    from PIL import ImageChops
    out = ImageChops.add(out, g); out = ImageChops.add(out, lay.filter(ImageFilter.GaussianBlur(1))); return out

def center(im, text, y, size, fill=WHITE, font=PF, stroke=0, sfill=PURP, alpha=1.0, blur=0, dx=0):
    f = ImageFont.truetype(font, size); lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    w = d.textlength(text, font=f); d.text(((CANVAS_W - w) / 2 + dx, y), text, font=f, fill=fill + (int(255 * alpha),), stroke_width=stroke, stroke_fill=sfill + (int(255 * alpha),))
    if blur: lay = lay.filter(ImageFilter.GaussianBlur(blur))
    im.paste(lay, (0, 0), lay); return y + size + 14

def glow_word(im, text, y, size, col=(190, 120, 255)):
    f = ImageFont.truetype(HF, size); lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    w = d.textlength(text, font=f); x = (CANVAS_W - w) / 2
    d.text((x, y), text, font=f, fill=col + (255,)); g = lay.filter(ImageFilter.GaussianBlur(22))
    im.paste(g, (0, 0), g); im.paste(g, (0, 0), g)
    d2 = ImageDraw.Draw(im); d2.text((x, y), text, font=f, fill=YEL, stroke_width=12, stroke_fill=PURP); return y + size + 14

def stamp(im, text, cx, cy, size=64, ang=-8):
    f = ImageFont.truetype(HF, size); tmp = ImageDraw.Draw(im); tw = tmp.textlength(text, font=f)
    lay = Image.new('RGBA', (int(tw) + 80, size + 60), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle([4, 4, lay.width - 4, lay.height - 4], radius=14, outline=(230, 40, 50), width=8, fill=(40, 6, 10, 140))
    d.text((40, 22), text, font=f, fill=(240, 50, 60)); r = lay.rotate(ang, expand=True, resample=Image.BICUBIC)
    im.paste(r, (int(cx - r.width / 2), int(cy - r.height / 2)), r)

def heart(im, x, y, s=90):
    e = brand.emoji_img('❤', s); im.paste(e, (x, y), e)

def frames():
    F = {}
    # 0.8 dtk: hantaman kata pertama
    im = crack(black()); im = im.filter(ImageFilter.GaussianBlur(0.6))
    hl(im, 'DENGAR ITU?', y=760, size=150); F['01_hook_0.8s_DENGAR-ITU'] = im
    # 2.6 dtk: kata pertama mundur (blur, naik, redup), kalimat kedua per kata
    im = black(); lay = black(); hl(lay, 'DENGAR ITU?', y=300, size=110); lay = lay.filter(ImageFilter.GaussianBlur(10))
    im = Image.blend(im, lay, .28); im = crack(im, n=5, seed=8)
    y = center(im, 'ada yang mengaum', 760, 76); y = center(im, 'dari dalam', y, 76); glow_word(im, 'PORTAL', y + 20, 170)
    F['02_hook_2.6s_PORTAL'] = im
    # 6 dtk: bayi naga
    im = dim(load(A / 'bg_drama.png'), .35); y = hl(im, 'BAYI NAGA', y=520, size=130); hl(im, 'IBUNYA KE MANA?', y=y + 20, size=96); F['03_scene_6s_BAYI-NAGA'] = im
    # 11 dtk: sekolah mage
    im = dim(load(A / 'bg_vote.png'), .2); y = hl(im, 'KALIAN YANG PILIH!', y=270, size=96)
    grid(im, [(f"@{CFG['user']} · {CFG['likes']} LIKE", 'o'), (CFG['usul'].upper(), 'y')], y + 40, cols=1, pw=700, ph=92, size=40)
    heart(im, 250, 800, 110); center(im, '0 → 3', 785, 120, fill=YEL, font=HF, stroke=12, dx=70)
    stamp(im, 'RESMI DIBANGUN', 460, 1080, 70)
    F['04_scene_11s_SEKOLAH-MAGE'] = im
    # 15 dtk: warga baru
    im = dim(load(A / 'bg_kota.png'), .2); y = hl(im, f"+{CFG['baru']} WARGA BARU!", y=280, size=96)
    grid(im, [('@' + n, k) for n, k in zip(CFG['names'], 'py')], y + 30, cols=1, pw=760, ph=84, gap=14, size=34)
    c = brand.counter_img(CFG['pop']); im.paste(c.convert('RGB'), ((1080 - 340) // 2 - 80, 1150), c)
    stamp(im, f"SISA {CFG['sisa']}", 540, 1330, 76, -6)
    F['05_scene_15s_WARGA-BARU'] = im
    # 20 dtk: A/B beradu
    im = dim(load(A / 'bg_drama.png'), .3); y = hl(im, 'MALAM INI, SIAPA JAGA BAYI NAGA?', y=300, size=84)
    grid(im, [('A: KNIGHT JAGA DI PORTAL', 'g'), ('B: MAGE SELIDIKI PORTAL', 'o')], y + 40, cols=1, pw=820, ph=110, size=38)
    y += 290
    hl(im, 'KOMEN A ATAU B!', y=y + 20, size=96); F['06_scene_20s_AB'] = im
    # 28 dtk: penutup
    im = black(); im = crack(im, n=6, seed=12); f = ImageFont.truetype(HF, 560); d = ImageDraw.Draw(im); w = d.textlength('9.', font=f)
    d.text(((CANVAS_W - w) / 2, 480), '9.', font=f, fill=YEL, stroke_width=20, stroke_fill=PURP)
    y = center(im, 'warga lagi...', 1120, 76); hl(im, 'PERANG.', y=y + 10, size=140); F['07_penutup_28s_9-PERANG'] = im
    return F

def sheet(F):
    keys = sorted(F); tw, th = 360, 640; cols = 4; rows = (len(keys) + cols - 1) // cols
    sh = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 12) + 12), (30, 30, 30)); d = ImageDraw.Draw(sh)
    for i, k in enumerate(keys):
        r, c = divmod(i, cols); sh.paste(F[k].resize((tw, th), Image.LANCZOS), (12 + c * (tw + 12), 12 + r * (th + 12)))
    sh.save(OUT / '_sheet.png')

if __name__ == '__main__':
    F = frames()
    for k, im in F.items(): im.save(OUT / f'{k}.png')
    sheet(F); print(sorted(F))
