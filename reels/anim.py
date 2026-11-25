"""Mesin animasi scene (pop / slide / rise) di atas grafis terkunci brand.py."""
import subprocess
from PIL import Image, ImageDraw, ImageFont
from brand import (W, H, FPS, YEL, PURP, WHITE, PF, hl, pill, dim, load, emoji_img)

def ease_back(p):
    c1=1.70158; c3=c1+1; return 1+c3*(p-1)**3+c1*(p-1)**2
def ease_cubic(p): return 1-(1-p)**3
def mk_head(text,size,y_pad=10):
    lines=1+ (len(text)>16 and 1 or 0)  # estimasi tinggi, dipotong nanti
    cv=Image.new('RGBA',(920,(size+12)*3+40),(0,0,0,0))
    yend=hl(cv,text,y=y_pad,size=size)
    bb=cv.getbbox(); cv=cv.crop((0,0,920,min(cv.height,yend+25)))
    return cv, yend-y_pad
def mk_pill(txt,key,w,h,size,emoji=None,esize=None):
    cv=Image.new('RGBA',(w+12,h+16),(0,0,0,0)); d=ImageDraw.Draw(cv)
    pill(d,0,0,w,h,('      '+txt) if emoji else txt,key,size)
    if emoji:
        es=esize or int(h*.68); cv.alpha_composite(emoji_img(emoji,es),(28,(h-es)//2+2))
    return cv
class El:
    def __init__(s,img,x,y,t0,kind='pop',dur=.28,dirx=1,hold=None): s.img,s.x,s.y,s.t0,s.kind,s.dur,s.dirx=img,x,y,t0,kind,dur,dirx
def paste_alpha(bg,im,x,y,a):
    if a<=0: return
    if a<1:
        im=im.copy(); al=im.getchannel('A').point(lambda v:int(v*a)); im.putalpha(al)
    bg.alpha_composite(im,(int(x),int(y))) if 0<=x and 0<=y and x+im.width<=bg.width and y+im.height<=bg.height else bg.paste(im,(int(x),int(y)),im)
def draw_el(frame,e,t):
    p=(t-e.t0)/e.dur
    if p<=0: return
    p=min(p,1.0); img=e.img; x,y=e.x,e.y
    if e.kind=='pop':
        s=max(0.01,ease_back(p)); a=min(1,p*4)
        if abs(s-1)>.005:
            w,h=img.size; nw,nh=max(1,int(w*s)),max(1,int(h*s)); img=img.resize((nw,nh),Image.BILINEAR)
            x=x+(w-nw)/2; y=y+(h-nh)/2
    elif e.kind=='slide':
        a=min(1,p*4); x=x+(1-ease_cubic(p))*140*e.dirx
    elif e.kind=='rise':
        a=min(1,p*4); y=y+(1-ease_cubic(p))*90
    # tempel
    layer=Image.new('RGBA',frame.size,(0,0,0,0)); 
    if a<1: img=img.copy(); img.putalpha(img.getchannel('A').point(lambda v:int(v*a)))
    frame.alpha_composite(img,(int(max(0,min(x,W-img.width))) if False else int(x),int(y))) if (x>=0 and y>=0 and x+img.width<=W and y+img.height<=H) else _clip_paste(frame,img,int(x),int(y))
def _clip_paste(frame,img,x,y):
    x0,y0=max(0,x),max(0,y); x1,y1=min(W,x+img.width),min(H,y+img.height)
    if x1<=x0 or y1<=y0: return
    frame.alpha_composite(img.crop((x0-x,y0-y,x1-x,y1-y)),(x0,y0))
def render(out,bgs,dur,els,zoom=.06):
    """bgs: PIL RGB 1080x1920 (atau list [(t_mulai,img)])"""
    n=round(dur*FPS)
    pr=subprocess.Popen(f'ffmpeg -v error -y -f rawvideo -pix_fmt rgb24 -s {W}x{H} -r {FPS} -i - -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p {out}',shell=True,stdin=subprocess.PIPE)
    if isinstance(bgs,Image.Image): bgs=[(0,bgs)]
    for i in range(n):
        t=i/FPS
        b=[im for ts,im in bgs if ts<=t][-1]
        z=1+zoom*t/dur
        if z>1.0005:
            cw,ch=W/z,H/z; x0,y0=(W-cw)/2,(H-ch)/2
            fr=b.resize((W,H),Image.BICUBIC,box=(x0,y0,x0+cw,y0+ch))
        else: fr=b
        fr=fr.convert('RGBA')
        for e in els: draw_el(fr,e,t)
        pr.stdin.write(fr.convert('RGB').tobytes())
    pr.stdin.close(); pr.wait()
def crop916(path,cx,H2=1190):
    im=Image.open(path).convert('RGB'); w0,h0=im.size; w=int(H2*9/16); x=int(min(max(cx*w0-w/2,0),w0-w))
    return im.crop((x,0,x+w,H2)).resize((W,H),Image.LANCZOS)
