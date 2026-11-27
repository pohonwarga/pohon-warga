// Balas komentar Instagram otomatis dengan template tetap (tanpa AI, tanpa kuota Claude).
// Pakai: node scripts/reply.js [--dry] [--max 30]
//   --dry : hanya mencetak balasan yang AKAN dikirim, tidak mengirim apa pun
// Env: IG_TOKEN, IG_USER_ID (opsional IG_API_HOST)
// Catatan: id komentar yang sudah dibalas disimpan di site/data/replied.json supaya tidak dobel.
const fs = require('fs'), path = require('path');
const { parseBuild: parseBuildRaw, CFG } = require('../engine/engine');
// "taman bermain / playground / wahana" bukan kebun (di engine kata "taman" = kebun): dicatat sebagai usulan biasa.
const NOT_KEBUN = /taman\s+(bermain|hiburan|main|anak|wahana|rekreasi)|playground|wahana|kolam renang/i;
const parseBuild = t => (NOT_KEBUN.test(String(t)) ? null : parseBuildRaw(t));

const BASE = `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/v21.0`;
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'site', 'data');
const FILE = path.join(DATA, 'replied.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const MAX = parseInt((args[args.indexOf('--max') + 1]) || '30', 10) || 30;
// Batas balasan per hari (tanggal WIB). Bisa diubah lewat env DAILY_REPLY_MAX.
const DAILY_MAX = parseInt(process.env.DAILY_REPLY_MAX || '50', 10) || 50;
const todayWIB = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hashStr = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// Nama tampilan bangunan untuk balasan. Jenis lain jatuh ke nama jenisnya sendiri.
const NAMA = { rumah: 'rumah', warung: 'warung', balai: 'balai warga', sumur: 'sumur', menara: 'menara', kebun: 'kebun', jembatan: 'jembatan', lampion: 'lampion' };

// Beberapa pilihan emoji per jenis (dipilih acak-deterministik dari id komentar).
const EMO_BUILD = { rumah: ['🏠', '🏡', '🧱'], warung: ['🍜', '🍛', '🥘'], balai: ['🏛️', '🤝', '📣'], sumur: ['💧', '🪣', '🌊'], menara: ['🗼', '🏗️', '🔭'], kebun: ['🌷', '🌳', '🌻'], jembatan: ['🌉', '🪵', '🚶'], lampion: ['🏮', '✨', '💡'], mercusuar: ['🗼', '🌊', '⛵'] };
// Permintaan lain, dicocokkan dari kata di komentar (yang pertama cocok dipakai).
const EMO_WORDS = [
  [/gereja|katedral/i, ['⛪', '🙏', '🕊️']], [/masjid|musala|musholla|surau/i, ['🕌', '🤲', '🌙']], [/pura/i, ['🛕', '🙏']], [/vihara|klenteng/i, ['🏯', '🙏']], [/ibadah/i, ['🙏', '🕊️']],
  [/mall|mal\b|plaza/i, ['🏬', '🛍️', '🛒']], [/pasar|bazar|bazaar/i, ['🛒', '🧺', '🥬']], [/alfamart|indomaret|minimarket|toko/i, ['🏪', '🛒', '🧃']],
  [/sawah|padi|ladang/i, ['🌾', '🌱', '🚜']], [/plta|listrik|pembangkit|pltu/i, ['⚡', '💡', '🔌']], [/sekolah|kampus|perpustakaan/i, ['📚', '🎒', '✏️']],
  [/rumah sakit|puskesmas|klinik/i, ['🏥', '💊', '🩺']], [/kuda|pacuan/i, ['🐎', '🏇']], [/panggung|konser|seni/i, ['🎭', '🎤', '🎶']], [/pendopo/i, ['🛖', '🪑']],
  [/kolam|danau|ikan|pancing/i, ['🎣', '🐟', '🌊']], [/stadion|lapangan|bola/i, ['⚽', '🏟️']], [/hotel|villa|penginapan/i, ['🏨', '🛏️']],
  [/kafe|cafe|kopi/i, ['☕', '🧁']], [/warteg|restoran|nasi|bakso|seblak|padang/i, ['🍛', '🍜', '🌶️']], [/taman bermain|playground/i, ['🎠', '🛝']],
  [/bandara|pelabuhan|stasiun|terminal/i, ['🚉', '🚌']], [/pabrik|industri/i, ['🏭', '⚙️']], [/benteng|kastil|istana/i, ['🏰', '👑']],
];
const GENERIC_EMO = ['🏗️', '🙌', '✨', '👷', '🌟'];
const pick = (arr, h) => arr[h % arr.length];
function emojiFor(text, h) { for (const [re, es] of EMO_WORDS) if (re.test(text)) return pick(es, h); return pick(GENERIC_EMO, h); }

// Template. {u} = username, {b} = nama bangunan, {e} = emoji. Dipilih deterministik dari id komentar.
const T_BUILD = [       // bangunan yang dikenali
  '@{u} makasih, saya udah catat ya! {b} {e}',
  '@{u} makasih ya, {b} sudah saya catat {e} nanti pantau likes-nya ya',
  '@{u} saya udah catat {b} ya {e} makasih usulannya!',
  '@{u} {b} masuk daftar usulan {e} makasih ya, saya udah catat',
  '@{u} oke, {b} sudah saya catat {e} ajak teman like komen ini biar cepat dibangun 😄',
  '@{u} wah {b}, boleh juga {e} makasih, sudah saya catat',
  '@{u} makasih! {b} masuk antrean {e} saya udah catat ya',
  '@{u} {b} dicatat ya {e} makasih udah kasih ide',
];
const T_NOBUILD = [     // permintaan di luar pilihan: cukup dicatat, tidak menjanjikan
  '@{u} makasih, saya udah catat ya! {e}',
  '@{u} makasih usulannya {e} sudah saya catat',
  '@{u} oke {e} saya catat dulu ya, makasih!',
  '@{u} makasih ya {e} saya udah catat, belum tentu langsung dibangun tapi tetap masuk daftar',
  '@{u} makasih {e} usulanmu sudah saya catat, pantengin terus desanya',
  '@{u} siap {e} makasih, saya udah catat ya',
  '@{u} {e} makasih idenya, saya catat ya',
];
const T_WELCOME = [     // sapaan, emoji, "sudah follow", dll -> ajak pilih job
  '@{u} makasih, saya udah catat ya! {e} kamu sekarang warga desa ini 🏡',
  '@{u} makasih ya {e} sudah saya catat, selamat datang di desa!',
  '@{u} halo warga baru {e} makasih, saya udah catat ya',
  '@{u} makasih udah gabung {e} saya udah catat kok',
  '@{u} {e} makasih ya, sudah saya catat. selamat datang di desa 🙌',
  '@{u} senang kamu ikut {e} makasih, saya udah catat',
  '@{u} makasih udah mampir dan follow {e} saya catat ya',
  '@{u} halo {e} makasih ya, kamu sudah saya catat sebagai warga',
];
const T_SORRY = [       // komentar kecewa / merasa tidak dianggap
  '@{u} eh maaf ya, bukan dicuekin kok 🥺 komenmu udah kebaca sekarang',
  '@{u} waduh sorry banget 🙏 kelewat tadi, sekarang udah kebaca ya',
  '@{u} maaf ya kalau sempat kelewat 😅 sekarang udah dibaca kok',
  '@{u} sorry ya, komenmu banyak yang masuk jadi telat 🥺 sekarang udah kebaca',
];
const T_JOB = {         // pilihan job: {j} = nama job
  KNIGHT: [
    '@{u} makasih, saya udah catat ya! KNIGHT 🛡️',
    '@{u} oke, KNIGHT udah saya catat ya 🛡️',
    '@{u} siap, saya catat kamu jadi KNIGHT ⚔️',
    '@{u} makasih ya, KNIGHT sudah saya catat 🛡️',
    '@{u} KNIGHT tercatat, makasih udah ikut desa ya ⚔️',
    '@{u} makasih, saya udah catat KNIGHT-mu ya 🙌',
  ],
  MAGE: [
    '@{u} makasih, saya udah catat ya! MAGE 🔮',
    '@{u} oke, MAGE udah saya catat ya 🔮',
    '@{u} siap, saya catat kamu jadi MAGE ✨',
    '@{u} makasih ya, MAGE sudah saya catat 🪄',
    '@{u} MAGE tercatat, makasih udah ikut desa ya ✨',
    '@{u} makasih, saya udah catat MAGE-mu ya 🙌',
  ],
  RANGER: [
    '@{u} makasih, saya udah catat ya! RANGER 🏹',
    '@{u} oke, RANGER udah saya catat ya 🎯',
    '@{u} siap, saya catat kamu jadi RANGER 🏹',
    '@{u} makasih ya, RANGER sudah saya catat 🎯',
    '@{u} RANGER tercatat, makasih udah ikut desa ya 🏹',
    '@{u} makasih, saya udah catat RANGER-mu ya 🙌',
  ],
};
const JOB_NAME = { KNIGHT: 'KNIGHT 🛡️', MAGE: 'MAGE 🔮', RANGER: 'RANGER 🏹' };
const T_JOBBUILD = [    // komentar berisi job DAN permintaan bangunan
  '@{u} makasih, saya udah catat jobmu {j} dan usulan {b} ya {e}',
  '@{u} makasih ya, {j} dan {b} sudah saya catat {e}',
  '@{u} oke, {j} + {b} udah saya catat ya {e}',
  '@{u} makasih! {j} tercatat, {b} juga masuk daftar {e}',
  '@{u} saya udah catat {j} sama {b} ya {e} makasih',
];
const T_WELCOME_DONE = [   // untuk yang SUDAH memilih job: tidak disuruh pilih lagi
  '@{u} makasih, saya udah catat ya {e} jobmu sudah tercatat kok',
  '@{u} halo lagi {e} makasih, saya udah catat',
  '@{u} {e} makasih udah setia mantengin desa, sudah saya catat',
  '@{u} makasih ya {e} ajak teman-temanmu gabung juga, saya udah catat',
  '@{u} {e} siap, saya udah catat ya, kamu aman di catatan',
];
const T_SORRY_DONE = [
  '@{u} eh maaf ya, bukan dicuekin kok 🥺 komenmu udah kebaca, jobmu juga udah tercatat',
  '@{u} waduh sorry 🙏 kelewat tadi, sekarang udah kebaca. jobmu aman kok',
  '@{u} maaf ya kalau sempat kelewat 😅 sekarang udah dibaca',
];
const JOB_CTAS = [
  ' Pilih jobmu juga ya: KNIGHT, MAGE, atau RANGER ⚔️',
  ' Oh ya, jobmu apa? KNIGHT, MAGE, atau RANGER 🛡️',
  ' Sekalian komen jobmu ya: KNIGHT / MAGE / RANGER',
  ' Mau jadi apa pas perang? KNIGHT, MAGE, atau RANGER? 🏹',
  ' Jangan lupa pilih job: KNIGHT, MAGE, atau RANGER ⚔️',
  ' Kamu tim KNIGHT, MAGE, atau RANGER nih? 🔮',
];
function detectJob(text) {
  const t = String(text);
  const m = t.match(/\b(knight|ksatria|swordman|swordsman|pedang)\b|\b(mage|penyihir|sihir)\b|\b(r[ae]ng+[ae]r|archer|pemanah|panah)\b/i);
  if (!m) return null;
  return m[1] ? 'KNIGHT' : m[2] ? 'MAGE' : 'RANGER';
}
const T_MULTI = [       // satu komentar berisi banyak permintaan
  '@{u} wah banyak banget idenya 😄 semua dicatat, tapi dibangun satu-satu ya',
  '@{u} semangat banget nih 🤩 dicatat semua ya, bertahap bangunnya',
  '@{u} listnya panjang juga hehe 😅 udah masuk catatan semua',
  '@{u} banyak ide bagus! 😍 Mayor Budi catat semuanya',
  '@{u} oke oke, semuanya dicatat 📝 tinggal lihat mana yang likes-nya paling banyak',
];
const T_KELUAR = [
  '@{u} oke, dicatat ya. makasih udah mampir 🙏',
  '@{u} siap. kapan-kapan main lagi ya 👋',
  '@{u} yah, sayang banget. makasih udah pernah ikut ya 🙏',
];

// Sentuhan kecil agar tidak seragam: kadang tanpa emoji di akhir, kadang huruf kecil di awal, dsb. (deterministik dari id)
function humanize(t, h) {
  const m = (h >>> 11) % 8;
  if (m === 0) t = t.replace(/\s*(\p{Extended_Pictographic}\uFE0F?)+\s*$/u, '');      // tanpa emoji penutup
  else if (m === 1) t = t.replace(/!(?=\s|$)/, '');                                       // tanpa tanda seru
  else if (m === 2) t = t.replace(/ ya\b/, ' yaa');
  return t;
}

function pickReply(c, ctx = {}) {
  const done = !!(ctx.chosen && c.username && ctx.chosen.has(String(c.username).toLowerCase()));   // sudah pilih job
  const text = String(c.text || '');
  const h = hashStr(c.id);
  let list, b = '', e = pick(GENERIC_EMO, h);
  const own = (text.match(/\p{Extended_Pictographic}/u) || [])[0];       // emoji yang dipakai si pengomentar
  const items = text.split(/,|\bsama\b|\bdan\b|\bserta\b/i).filter(x => x.trim().length > 2).length;
  const buildable = /rumah sakit|rumah ibadah/i.test(text) ? null : parseBuild(text);  // "rumah sakit" bukan "rumah"
  const job = detectJob(text);
  if (job) {
    const bd = /rumah sakit|rumah ibadah/i.test(text) ? null : parseBuild(text);
    const wants = bd || /\b(bangun|bikin|buatin|tambah|minta|usul)/i.test(text);
    if (wants) { const bn = bd ? (NAMA[bd] || bd) : 'bangunanmu'; const eb = bd ? pick(EMO_BUILD[bd] || GENERIC_EMO, h >>> 3) : emojiFor(text, h >>> 3); return pick(T_JOBBUILD, h).replace('{u}', c.username).replace('{j}', JOB_NAME[job]).replace('{b}', bn).replace('{e}', eb); }
    return pick(T_JOB[job], h).replace('{u}', c.username);
  }
  if (/\bkeluar\b/i.test(text)) list = T_KELUAR;
  else if (/(ga|gak|nggak|tidak|ngga|belum)\s*(di)?(anggap|notice|bales|balas|respon)|dicuekin|diabaikan|cuek/i.test(text)) list = done ? T_SORRY_DONE : T_SORRY;
  else if (items >= 3) list = T_MULTI;
  else if (buildable) { list = T_BUILD; b = NAMA[buildable] || buildable; e = pick(EMO_BUILD[buildable] || GENERIC_EMO, h >>> 3); }
  else if (/\b(bangun|bikin|buat|buatin|dong|minta|tambah)/i.test(text)) { list = T_NOBUILD; e = emojiFor(text, h >>> 3); }
  else { list = done ? T_WELCOME_DONE : T_WELCOME; e = own || pick(['🙌', '😊', '🎉'], h >>> 3); }
  let out = pick(list, h).replace('{u}', c.username).replace('{b}', b).replace('{e}', e);
  // Day 4: balasan ajak pilih job, dengan kalimat yang berganti-ganti (dan sesekali dilewati supaya tidak terasa template)
  const wantsCta = !done && [T_BUILD, T_NOBUILD, T_MULTI, T_WELCOME, T_SORRY].includes(list) && !/KNIGHT|MAGE|RANGER/.test(out);
  if (wantsCta && (h >>> 5) % 6 !== 0) out += (/[.!?\p{Extended_Pictographic}]\uFE0F?$/u.test(out) ? '' : '.') + pick(JOB_CTAS, h >>> 7);
  return humanize(out, h);
}

async function call(method, p, params = {}) {
  const url = new URL(BASE + p);
  const body = new URLSearchParams({ access_token: process.env.IG_TOKEN, ...params });
  let res;
  if (method === 'GET') { body.forEach((v, k) => url.searchParams.set(k, v)); res = await fetch(url); }
  else res = await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) { const e = new Error(`${p}: ${j.error ? j.error.message : res.status}`); e.code = j.error && j.error.code; throw e; }
  return j;
}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

async function main() {
  const token = process.env.IG_TOKEN, uid = process.env.IG_USER_ID;
  if (!token || !uid) throw new Error('IG_TOKEN / IG_USER_ID belum diisi');
  fs.mkdirSync(DATA, { recursive: true });
  const state = readJson(FILE, { ids: [] });
  const done = new Set(state.ids);
  const today = todayWIB();
  let countToday = state.day === today ? (state.count || 0) : 0;
  const quota = Math.max(0, DAILY_MAX - countToday);
  const me = (await call('GET', `/${uid}`, { fields: 'username' })).username;
  const media = await call('GET', `/${uid}/media`, { fields: 'id', limit: 12 });
  media.data = (media.data || []).slice(0, 1);   // hanya post TERBARU (video Day 4 hari ini)
  const chosen = new Set(Object.keys((readJson(path.join(DATA, 'job-votes.json'), {}).votes) || {}));   // warga yang sudah pilih job
  const todo = [];
  for (const m of media.data || []) {
    let r = await call('GET', `/${m.id}/comments`, { fields: 'id,text,username,timestamp,replies{username}', limit: 50 });
    for (let page = 0; r && page < 5; page++) {
      for (const c of r.data || []) {
        if (!c.id || !c.username || !c.text) continue;
        if (c.username.toLowerCase() === me.toLowerCase()) continue;       // komentar sendiri
        if (detectJob(c.text)) chosen.add(c.username.toLowerCase());
        if (done.has(c.id)) continue;                                     // sudah dibalas oleh script
        const ownReply = ((c.replies && c.replies.data) || []).some(x => (x.username || '').toLowerCase() === me.toLowerCase());
        if (ownReply) { done.add(c.id); continue; }                       // sudah dibalas manual
        todo.push(c);
      }
      r = r.paging && r.paging.next ? await (await fetch(r.paging.next)).json() : null;
    }
  }
  todo.sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0));
  console.log(`${todo.length} komentar belum dibalas (akan diproses maksimal ${Math.min(MAX, quota)}, sisa kuota hari ini ${quota}/${DAILY_MAX}).${DRY ? ' MODE DRY: tidak mengirim apa pun.' : ''}`);
  let sent = 0;
  for (const c of todo.slice(0, Math.min(MAX, quota))) {
    const msg = pickReply(c, { chosen });
    if (DRY) { console.log(`- @${c.username}: "${c.text}"\n    -> ${msg}`); continue; }
    try {
      await call('POST', `/${c.id}/replies`, { message: msg });
      done.add(c.id); sent++; countToday++;
      console.log(`Dibalas @${c.username}`);
    } catch (e) {
      console.log(`Gagal membalas @${c.username}: ${e.message}`);
      if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) { console.log('Batas laju API tercapai, berhenti.'); break; }
      done.add(c.id); // jangan coba ulang komentar yang ditolak (mis. sudah dihapus)
    }
    await sleep(3000 + Math.floor(Math.random() * 7000));     // jeda acak 3-10 detik, seperti orang mengetik
  }
  if (!DRY) fs.writeFileSync(FILE, JSON.stringify({ ids: [...done].slice(-5000), day: today, count: countToday }));
  console.log(`Selesai. Terkirim: ${sent}.`);
}

if (require.main === module) main().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
module.exports = { pickReply, detectJob };
