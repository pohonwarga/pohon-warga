"""Scene Day 5 (referensi bentuk template). Aset latar di reels/assets/day5/."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from anim import *
from brand import ROOT
A = str(ROOT / 'assets' / 'day5') + '/'
O = A; V = A
OUT = str(ROOT / 'out') + '/'
Path(OUT).mkdir(exist_ok=True)
def center(img,w=920): return (w-img.width)//2
# ---------- A. bangunan lama (0.5s) + 4 detail ----------
def scene_bangunan_pill():
    bg=dim(load(A+'c_lh_full.png'),.1)
    h,hh=mk_head('BANGUNAN LAMA MASIH ADA',92); els=[El(h,center(h),240,0.0,'pop',.25)]
    y=240+hh+30; items=[('BALAI DESA','p'),('GRAND THEATER','y'),('MERCUSUAR','g'),('KEBUN WARGA','o'),('RUMAH WARGA','p'),('POHON BESAR','y')]
    for i,(t,k) in enumerate(items):
        r,c=divmod(i,2); pl=mk_pill(t,k,400,76,38)
        els.append(El(pl,50+c*410,y+r*90,0.08+i*0.05,'slide',.2,-1 if c==0 else 1))
    render(OUT+'a_pill.mp4',bg,0.5,els,zoom=.03)
DET=[('d_9',9,.6,'KEBUN WARGA','TEMPAT PANEN','g'),('d_14',14,.5,'MERCUSUAR','PENJAGA SUNGAI','o'),('d_27',27,.54,'BALAI DESA','MAYOR BUDI','p'),('d_34',34,.72,'POHON BESAR','MASIH BERDIRI','g')]
def scene_detail(i,dur):
    _,t,cx,head,chip,k=DET[i]; bg=crop916(A+f'full_{t}.png',cx)
    h,hh=mk_head(head,92); els=[El(h,center(h),290,0.0,'pop',.16)]
    pl=mk_pill(chip,k,700,84,38); els.append(El(pl,(920-700)//2,1400,0.06,'rise',.18))
    render(OUT+f'a_det{i}.mp4',bg,dur,els,zoom=.05)
# ---------- B. job ----------
K=['farrbo_','pemalas_forsaken','rayx_0914','zanntrade','mhmmad__rizal','ell6.970','ariffinputra.m']
M=['bundaqwil','theonly.wulan26','xieshn','alincarisaputri','jullll__111','mkhayrasyaq','mas.brayennn','falov_kaltim04','kurniatii060']
R=['pzl_rsly','acapp_goodending','bimgoyyyy_','eliezarmanglassa2004']
def scene_job(dur):
    bg=dim(load(A+'c_jobs.png'),.35)
    h,hh=mk_head('20 WARGA TERDAFTAR',84); els=[El(h,center(h),180,0.0,'pop',.25)]
    y=180+hh+30; t=0.15
    def block(title,names,key,y,t):
        els.append(El(mk_pill(title,key,760,70,36),80-70+ (920-760)//2-80+0,y,t,'pop',.2)); 
        els[-1].x=(920-760)//2-6; y+=82; t+=.05
        for i,nm in enumerate(names):
            r,c=divmod(i,2); pl=mk_pill('@'+nm,key,360,58,24)
            els.append(El(pl,(920-734)//2+c*374,y+r*66,t+i*0.05,'slide',.18,-1 if c==0 else 1))
        rows=(len(names)+1)//2
        return y+rows*66+10,t+len(names)*0.05+0.05
    y,t=block(f'KNIGHT · {len(K)}',K,'y',y,t)
    y,t=block(f'MAGE · {len(M)}',M,'p',y,t)
    y,t=block(f'RANGER · {len(R)}',R,'g',y,t)
    els.append(El(mk_pill('FOLLOW + KOMEN = TERDAFTAR','o',800,76,34,'✅'),(920-800)//2-6,y+6,max(t,1.55),'pop',.25))
    render(OUT+'b_job.mp4',bg,dur,els,zoom=.04)
# ---------- C. terima kasih ----------
NAMES=[l.strip() for l in open(A+'followers_baru.txt') if l.strip() and not l.startswith('#')]
def scene_thanks(k):
    bg=load(A+'c_wide_full.png'); pg=NAMES[k*21:(k+1)*21]
    h,hh=mk_head(f'TERIMA KASIH WARGA BARU! ({k+1}/3)',84); els=[El(h,center(h),300,0.0,'pop',.25)]
    y=300+hh+30
    for i,nm in enumerate(pg):
        r,c=divmod(i,2); pl=mk_pill('@'+nm,['p','y','g','o'][(r+c)%4],405,68,28)
        els.append(El(pl,50+c*415,y+r*78,0.12+i*0.035,'slide',.2,-1 if c==0 else 1))
    render(OUT+f'c_thanks{k}.mp4',bg,1.5,els,zoom=.04)
# ---------- D. CTA ----------
def scene_cta(dur,times):
    bg=dim(crop916(A+'full_34.png',.72),.35)
    h,hh=mk_head('JADI WARGA!',110); els=[El(h,center(h),270,0.0,'pop',.3)]
    y=270+hh+50
    rows=[('FOLLOW = DAPAT RUMAH','y','🏠'),('KOMEN = GANTI JOB','p','⚔️'),('KOMEN = REQUEST BANGUNAN','g','🏗️'),('LIKES TERBANYAK = DIBANGUN!','o','❤️'),('AJAK TEMANMU JADI WARGA','p','👥')]
    for i,(t,k,e) in enumerate(rows):
        els.append(El(mk_pill(t,k,820,104,36,e),50-6,y+i*128,times[i],'slide' if i%2==0 else 'slide',.28,-1 if i%2==0 else 1))
    f=ImageFont.truetype(PF,40); s='SAMPAI 300 WARGA = PERANG DIMULAI'
    tmp=Image.new('RGBA',(920,90),(0,0,0,0)); d=ImageDraw.Draw(tmp); tw=d.textlength(s,font=f)
    tx=int((920-tw)/2+30); d.text((tx,20),s,font=f,fill=WHITE,stroke_width=6,stroke_fill=PURP); tmp.alpha_composite(emoji_img('⚔️',56),(max(0,tx-70),18))
    els.append(El(tmp,0,y+5*128,times[5],'pop',.3))
    render(OUT+'d_cta.mp4',bg,dur,els,zoom=.05)
# ---------- E. kunjungi ----------
def scene_kunjung(dur):
    bg=dim(load(A+'c_wide_full.png'),.15)
    h,hh=mk_head('AYO BERKUNJUNG KE KOTA BARU!',100); els=[El(h,center(h),300,0.0,'pop',.3)]
    y=300+hh+60
    els.append(El(mk_pill('KLIK LINK DI BIO','y',820,110,46,'🔗'),50-6,y,0.35,'pop',.3))
    els.append(El(mk_pill('KETIK USERNAME-MU = KETEMU','p',820,90,34,'🔎'),50-6,y+130,0.75,'pop',.3))
    render(OUT+'e_kunjung.mp4',bg,dur,els,zoom=.06)
if __name__=='__main__':
    which=sys.argv[1]
    if which=='pill': scene_bangunan_pill()
    if which=='det':
        # 4 detail, total 1.42 s -> frame boundaries
        b=[round((0.5+1.42*i/4)*30) for i in range(5)]
        for i in range(4): scene_detail(i,(b[i+1]-b[i])/30)
    if which=='job': scene_job(2.17)
    if which=='thanks':
        for k in range(3): scene_thanks(k)
    if which=='cta': scene_cta(7.5,[0.44,1.93,2.62,3.51,5.31,5.31])
    if which=='kunjung': scene_kunjung(2.94)
