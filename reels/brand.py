"""KUNCI GRAFIS Pohon Warga (gaya Day 3-5). Semua scene HARUS memakai fungsi di file ini.
Jangan menggambar judul/pill sendiri, jangan ganti warna, font, outline, atau ukuran di tempat lain."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / 'fonts'
W, H, FPS = 1080, 1920, 30
HF = str(FONTS / 'InterDisplay-Black.otf')      # judul (kapital)
PF = str(FONTS / 'Poppins-Bold.ttf')            # pill
EMOJI_FONT = str(FONTS / 'NotoColorEmoji.ttf')
YEL = (255, 214, 10)       # #FFD60A judul
PURP = (42, 15, 74)        # #2A0F4A outline, bayangan, teks pill terang
WHITE = (255, 255, 255)
# kunci pill: (warna isi, warna teks)  p=ungu y=kuning g=hijau o=oranye
C = {'p': ((110, 70, 255), WHITE), 'y': ((255, 200, 30), PURP), 'g': ((46, 170, 90), PURP), 'o': ((255, 125, 50), PURP)}
SAFE = {'top': 260, 'bottom': 440, 'right': 160}   # area yang harus kosong dari konten penting
HEAD_OUTLINE = 16          # tebal outline judul (px)
HEAD_MAXW = 840            # lebar maksimal teks judul
CANVAS_W = 920             # area konten 920 px dari kiri: sisa 160 px di kanan sengaja kosong (safe zone kanan)

def hl(im, text, y=290, size=104):
    """Judul kuning kapital dengan outline ungu tua. Mengembalikan y di bawah teks."""
    d = ImageDraw.Draw(im); f = ImageFont.truetype(HF, size); lines = []; cur = ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) > HEAD_MAXW and cur: lines.append(cur); cur = w
        else: cur = t
    lines.append(cur); yy = y
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text(((CANVAS_W - w) / 2, yy), ln, font=f, fill=YEL, stroke_width=HEAD_OUTLINE, stroke_fill=PURP)
        yy += size + 12
    return yy

def pill(d, x, y, w, h, txt, key, size=42):
    """Pill bulat penuh: isi berwarna, outline ungu 6px, bayangan ungu geser (4,8)."""
    bg, fg = C[key]
    d.rounded_rectangle([x + 4, y + 8, x + w + 4, y + h + 8], radius=h // 2, fill=PURP)
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg, outline=PURP, width=6)
    f = ImageFont.truetype(PF, size)
    while d.textlength(txt, font=f) > w - 40 and size > 20:
        size -= 2; f = ImageFont.truetype(PF, size)
    tw = d.textlength(txt, font=f); d.text((x + (w - tw) / 2, y + (h - size) / 2 - 6), txt, font=f, fill=fg)

def grid(im, items, y0, cols=2, pw=420, ph=76, gap=14, size=40):
    """Grid pill 2 kolom: items = [(teks, kunci_warna)]."""
    d = ImageDraw.Draw(im); x0 = (CANVAS_W - (cols * pw + (cols - 1) * gap)) / 2
    for i, (t, k) in enumerate(items):
        r, c = divmod(i, cols); pill(d, x0 + c * (pw + gap), y0 + r * (ph + gap), pw, ph, t, k, size)

def dim(im, a=0.25):
    o = Image.new('RGB', im.size, (20, 10, 40)); return Image.blend(im, o, a)

def load(p):
    return Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)

_EF = None
def emoji_img(ch, s):
    global _EF
    if _EF is None: _EF = ImageFont.truetype(EMOJI_FONT, 109)
    t = Image.new('RGBA', (140, 140)); ImageDraw.Draw(t).text((0, 0), ch, font=_EF, embedded_color=True)
    return t.crop(t.getbbox()).resize((s, s), Image.LANCZOS)

def counter_img(n, goal=300):
    """Penghitung kecil 'N/300 WARGA' (tempatkan di y >= 270 agar di luar safe zone atas) untuk template baru."""
    cv = Image.new('RGBA', (360, 90), (0, 0, 0, 0)); d = ImageDraw.Draw(cv)
    pill(d, 0, 0, 340, 70, f'{n}/{goal} WARGA', 'p', 34); return cv
