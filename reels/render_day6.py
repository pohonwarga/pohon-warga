"""Render Day 6 (hook kinetic baru). Video saja ke /tmp/d6/video_noaudio.mp4. Timing dari silencedetect VO eb892f86 (31.7 dtk)."""
import math, random, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
sys.path.insert(0, str(Path(__file__).resolve().parent))
import brand
from brand import W, H, FPS, YEL, PURP, WHITE, PF, HF, CANVAS_W, hl, pill, grid, dim, load
from anim import El, draw_el, mk_head, mk_pill, ease_cubic
import make_hook_day as mh

A = Path(__file__).resolve().parents[1] / 'reels' / 'assets' / 'day6' if False else Path(__file__).resolve().parent / 'assets' / 'day6'
DUR = 33.0
BLK = (8, 6, 14)
SC = dict(A=0.0, B=1.18, C=3.5, D=7.18, E=12.63, F=19.0, G1=27.0, G2=28.85)
CFG = mh.CFG

def mk_text(text, size, font=PF, fill=WHITE, stroke=0, sfill=PURP):
    f = ImageFont.truetype(font, size); d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    w = int(d.textlength(text, font=f)) + stroke * 2 + 8; cv = Image.new('RGBA', (w, size + 30 + stroke * 2), (0, 0, 0, 0))
    ImageDraw.Draw(cv).text((stroke + 4, stroke), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill); return cv

def mk_glow(text, size):
    f = ImageFont.truetype(HF, size); d = ImageDraw.Draw(Image.new('RGBA', (1, 1))); tw = int(d.textlength(text, font=f)); pad = 70
    cv = Image.new('RGBA', (tw + pad * 2, size + pad * 2), (0, 0, 0, 0)); ImageDraw.Draw(cv).text((pad, pad), text, font=f, fill=(190, 120, 255, 255))
    g = cv.filter(ImageFilter.GaussianBlur(24)); out = Image.new('RGBA', cv.size, (0, 0, 0, 0)); out.alpha_composite(g); out.alpha_composite(g)
    ImageDraw.Draw(out).text((pad, pad), text, font=f, fill=YEL + (255,), stroke_width=12, stroke_fill=PURP + (255,)); return out

def mk_stamp(text, size=64, ang=-8):
    f = ImageFont.truetype(HF, size); d = ImageDraw.Draw(Image.new('RGBA', (1, 1))); tw = d.textlength(text, font=f)
    lay = Image.new('RGBA', (int(tw) + 80, size + 60), (0, 0, 0, 0)); dd = ImageDraw.Draw(lay)
    dd.rounded_rectangle([4, 4, lay.width - 4, lay.height - 4], radius=14, outline=(230, 40, 50), width=8, fill=(40, 6, 10, 170))
    dd.text((40, 22), text, font=f, fill=(240, 50, 60)); return lay.rotate(ang, expand=True, resample=Image.BICUBIC)

def mk_heart(n):
    cv = Image.new('RGBA', (460, 150), (0, 0, 0, 0)); h = brand.emoji_img('❤', 110); cv.alpha_composite(h, (20, 18))
    t = mk_text(str(n), 120, HF, YEL, 12); cv.alpha_composite(t, (170, -6)); return cv

def black_crack(seed, n=9):
    return mh.crack(Image.new('RGB', (W, H), BLK), n=n, seed=seed)

def X(img): return int((W - img.width) / 2 - 80 + 80) if False else int((CANVAS_W - img.width) / 2)

# ---------- elemen ----------
head_dengar, _ = mk_head('DENGAR ITU?', 150); head_small = None
dengar_big = Image.new('RGBA', (920, 420), (0, 0, 0, 0)); hl(dengar_big, 'DENGAR ITU?', y=10, size=150)
dengar_small = Image.new('RGBA', (920, 300), (0, 0, 0, 0)); hl(dengar_small, 'DENGAR ITU?', y=10, size=110)
dengar_blur = dengar_small.filter(ImageFilter.GaussianBlur(10))
WORDS = [('ada', 1.25, 0), ('yang', 1.45, 0), ('mengaum', 1.65, 0), ('dari', 2.2, 1), ('dalam', 2.4, 1)]
word_imgs = {w: mk_text(w, 80) for w, _, _ in WORDS}
portal_img = mk_glow('PORTAL', 170)
bayi_head, _ = mk_head('BAYI NAGA', 130)
ibunya, _ = mk_head('IBUNYA KE MANA?', 96)
vote_head, _ = mk_head('KALIAN YANG PILIH!', 96)
pill_user = mk_pill(f"@{CFG['user']} · {CFG['likes']} LIKE", 'o', 700, 92, 40)
pill_usul = mk_pill(CFG['usul'].upper(), 'y', 700, 92, 40)
hearts = [mk_heart(n) for n in range(4)]
stamp_resmi = mk_stamp('RESMI DIBANGUN', 70, -8)
warga_head, _ = mk_head(f"+{CFG['baru']} WARGA BARU!", 96)
chip1 = mk_pill('@' + CFG['names'][0], 'p', 760, 84, 34); chip2 = mk_pill('@' + CFG['names'][1], 'y', 760, 84, 34)
chip_cari = mk_pill('CARI NAMAMU!', 'g', 560, 84, 40)
stamp_sisa = mk_stamp(f"SISA {CFG['sisa']}", 76, -6)
mal_head, _ = mk_head('MALAM INI, SIAPA JAGA BAYI NAGA?', 84)
pill_a = mk_pill('A: KNIGHT JAGA DI PORTAL', 'g', 820, 110, 38); pill_b = mk_pill('B: MAGE SELIDIKI PORTAL', 'o', 820, 110, 38)
komen, _ = mk_head('KOMEN A ATAU B!', 96)
jadi, _ = mk_head('JADI WARGA!', 110)
pill_follow = mk_pill('FOLLOW = DAPAT RUMAH', 'y', 820, 100, 36)
nine = Image.new('RGBA', (920, 760), (0, 0, 0, 0)); _f = ImageFont.truetype(HF, 560); _d = ImageDraw.Draw(nine); _w = _d.textlength('9.', font=_f)
_d.text(((920 - _w) / 2, 20), '9.', font=_f, fill=YEL, stroke_width=20, stroke_fill=PURP)
warga_lagi = mk_text('warga lagi...', 76); perang, _ = mk_head('PERANG.', 140)
counters = {n: brand.counter_img(n) for n in range(284, 292)}

def build_scene_els():
    E = {k: [] for k in SC}
    E['A'] = [El(dengar_big, 0, 700, 0.03, 'pop', .16)]
    E['B'] = []   # dibuat dinamis
    E['C'] = [El(bayi_head, 0, 520, 3.55, 'pop', .2)]
    E['D'] = [El(vote_head, 0, 270, 7.2, 'pop', .22), El(pill_user, 110, 520, 8.6, 'slide', .3, 1), El(pill_usul, 110, 640, 11.0, 'slide', .3, -1),
              El(stamp_resmi, 560 - stamp_resmi.width // 2, 900, 11.75, 'pop', .24)]
    E['E'] = [El(warga_head, 0, 280, 12.65, 'pop', .22), El(chip1, 80, 480, 14.15, 'slide', .3, 1), El(chip2, 80, 590, 15.2, 'slide', .3, -1),
              El(chip_cari, 180, 720, 17.0, 'pop', .25), El(stamp_sisa, 460 - stamp_sisa.width // 2, 1330, 17.9, 'pop', .24)]
    E['F'] = [El(mal_head, 0, 300, 19.0, 'pop', .22), El(pill_a, 50, 560, 22.16, 'slide', .3, -1), El(pill_b, 50, 690, 23.87, 'slide', .3, 1), El(komen, 0, 860, 25.83, 'pop', .22)]
    E['G1'] = [El(jadi, 0, 260, 27.0, 'pop', .22), El(pill_follow, 50, 560, 27.26, 'pop', .25)]
    E['G2'] = [El(nine, 0, 480, 28.88, 'pop', .2), El(warga_lagi, int((CANVAS_W - warga_lagi.width) / 2), 1230, 29.5, 'rise', .3), El(perang, 0, 1340, 30.36, 'pop', .2)]
    return E

def scene_of(t):
    cur = 'A'
    for k, s in SC.items():
        if t >= s: cur = k
    return cur

SHAKES = [(0.03, .25, 9), (2.7, .35, 11), (3.55, .22, 8), (11.75, .25, 8), (12.65, .2, 7), (23.87, .25, 9), (25.83, .2, 7), (28.88, .45, 16), (30.36, .6, 20)]
FLASH = [3.5, 7.18, 12.63, 19.0, 27.0, 28.85, 30.36, 2.7, 24.0]
PUNCH = [3.5, 7.18, 12.63, 19.0, 27.0, 28.88, 30.36]

def camera(img, t, rnd):
    amp = 0
    for s, d, a in SHAKES:
        if s <= t < s + d: amp = max(amp, a * (1 - (t - s) / d))
    p = 0.0
    for s in PUNCH:
        if s <= t < s + .22: p = max(p, .05 * (1 - (t - s) / .22))
    z = 1 + p + (0.03 if amp else 0)
    if z > 1.0005:
        dx, dy = rnd.uniform(-amp, amp), rnd.uniform(-amp, amp); cw, ch = W / z, H / z; x0, y0 = (W - cw) / 2 + dx, (H - ch) / 2 + dy
        x0 = max(0, min(W - cw, x0)); y0 = max(0, min(H - ch, y0)); img = img.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
    fa = 0
    for s in FLASH:
        if s <= t < s + .07: fa = max(fa, .55 * (1 - (t - s) / .07))
    if fa > 0: img = Image.blend(img, Image.new('RGB', (W, H), (255, 255, 255)), fa)
    return img

def zoom_bg(bg, t, s0, s1, z0=1.0, z1=1.07):
    p = min(1, max(0, (t - s0) / (s1 - s0))); z = z0 + (z1 - z0) * p
    if z <= 1.0005: return bg
    cw, ch = W / z, H / z; x0, y0 = (W - cw) / 2, (H - ch) / 2; return bg.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/d6/video_noaudio.mp4'
    only = [float(x) for x in sys.argv[2:]]   # jika diberi detik: simpan PNG saja untuk cek
    cracks = {k: [black_crack(s, n) for s in (3, 7, 12)] for k, n in (('A', 9), ('B', 5), ('G2', 7))}
    bgs = {'D': dim(load(A / 'bg_vote.png'), .2), 'E': dim(load(A / 'bg_kota.png'), .2), 'F': dim(load(A / 'bg_drama.png'), .3), 'G1': dim(load(A / 'bg_kota2.png'), .35)}
    veo = sorted(Path('/tmp/d6/veo').glob('*.png')); E = build_scene_els(); rnd = random.Random(1)
    n = round(DUR * FPS)
    pr = None
    if not only:
        pr = subprocess.Popen(f'ffmpeg -v error -y -f rawvideo -pix_fmt rgb24 -s {W}x{H} -r {FPS} -i - -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p {out}', shell=True, stdin=subprocess.PIPE)
    frames = [round(t * FPS) for t in only] if only else range(n)
    for i in frames:
        t = i / FPS; s = scene_of(t); flick = int(t * 14) % 3
        if s in ('A', 'B', 'G2'):
            fr = cracks[s][flick].copy()
            if s == 'G2' and t < 28.88: fr = Image.new('RGB', (W, H), BLK)
        elif s == 'C':
            k = min(len(veo) - 1, int((t - SC['C']) * FPS)); fr = dim(Image.open(veo[k]).convert('RGB'), .35)
            fr = zoom_bg(fr, t, 3.5, 7.18, 1.0, 1.05)
        else:
            fr = zoom_bg(bgs[s], t, SC[s], list(SC.values())[list(SC).index(s) + 1] if s != 'G2' else 33, 1.0, 1.07)
        fr = fr.convert('RGBA')
        if s == 'A':
            for e in E['A']: draw_el(fr, e, t)
        if s == 'B':
            p = min(1, max(0, (t - 1.18) / .35)); q = ease_cubic(p)
            im = Image.blend(dengar_big.convert('RGBA').resize(dengar_small.size), dengar_big.convert('RGBA').resize(dengar_small.size), 0) if False else None
            big = dengar_big if p < .5 else dengar_blur
            sc = 1 - .27 * q; y = 700 - 400 * q; a = 1 - .72 * q
            src = dengar_big if p < .4 else dengar_blur
            tmp = src.resize((int(src.width * sc * (110 / 150 if src is dengar_blur else 1)), int(src.height * sc * (110 / 150 if src is dengar_blur else 1)))) if False else src
            ov = dengar_small if p >= .35 else dengar_big
            ov = (dengar_blur if p >= .35 else dengar_big).copy(); al = ov.getchannel('A').point(lambda v: int(v * a)); ov.putalpha(al)
            yy = 700 - 400 * q if p < 1 else 300
            fr.alpha_composite(ov, (0, int(max(0, yy))))
            lines = {0: [], 1: []}
            for w, t0, ln in WORDS: lines[ln].append((w, t0))
            for ln, ws in lines.items():
                spacing = 26; tot = sum(word_imgs[w].width for w, _ in ws) + spacing * (len(ws) - 1); x = (CANVAS_W - tot) / 2
                for w, t0 in ws:
                    im = word_imgs[w]; e = El(im, x, 700 + ln * 100, t0, 'rise', .22); draw_el(fr, e, t); x += im.width + spacing
            draw_el(fr, El(portal_img, int((CANVAS_W - portal_img.width) / 2), 880, 2.7, 'pop', .22), t)
        if s == 'C':
            for e in E['C']: draw_el(fr, e, t)
            if t >= 5.72:
                pp = min(1, (t - 5.72) / .75); steps = max(1, int(pp * 15)); w = int(ibunya.width * steps / 15)
                crop = ibunya.crop((0, 0, w, ibunya.height)); fr.alpha_composite(crop, (0, 520 + 160 + 20)) if False else fr.alpha_composite(crop, (0, 700))
        if s in ('D', 'E', 'F', 'G1', 'G2'):
            for e in E[s]: draw_el(fr, e, t)
        if s == 'D':
            for k, t0 in enumerate((10.1, 10.3, 10.5, 10.7)):
                if t >= t0 and (k == 3 or t < (10.1, 10.3, 10.5, 10.7)[k + 1]): draw_el(fr, El(hearts[k], 330, 760, t0, 'pop', .16), t)
        if s == 'E':
            if t >= 12.9:
                pp = min(1, (t - 12.9) / .9); nval = 284 + int(round(pp * 7)); c = counters[nval]
                sc = 1 + (.1 * math.sin(min(1, (t - 13.8) / .15) * math.pi) if t >= 13.8 else 0)
                cc = c if sc == 1 else c.resize((int(c.width * sc), int(c.height * sc)))
                fr.alpha_composite(cc, (int(350 - cc.width / 2 + 80), 1150))
        if s == 'G1':
            c = counters[291]; fr.alpha_composite(c, (int((CANVAS_W - 340) / 2), 760))
        frame = camera(fr.convert('RGB'), t, rnd)
        if only: frame.save(f'/tmp/d6/chk_{t:.2f}.png')
        else: pr.stdin.write(frame.tobytes())
    if pr: pr.stdin.close(); pr.wait()

if __name__ == '__main__': main()
