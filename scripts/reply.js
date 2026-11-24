// Balas komentar Instagram otomatis dengan template tetap (tanpa AI, tanpa kuota Claude).
// Pakai: node scripts/reply.js [--dry] [--max 30]
//   --dry : hanya mencetak balasan yang AKAN dikirim, tidak mengirim apa pun
// Env: IG_TOKEN, IG_USER_ID (opsional IG_API_HOST)
// Catatan: id komentar yang sudah dibalas disimpan di site/data/replied.json supaya tidak dobel.
const fs = require('fs'), path = require('path');
const { parseBuild, CFG } = require('../engine/engine');

const BASE = `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/v21.0`;
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'site', 'data');
const FILE = path.join(DATA, 'replied.json');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const MAX = parseInt((args[args.indexOf('--max') + 1]) || '30', 10) || 30;
// Batas balasan per hari (tanggal WIB). Bisa diubah lewat env DAILY_REPLY_MAX.
const DAILY_MAX = parseInt(process.env.DAILY_REPLY_MAX || '30', 10) || 30;
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
  '@{u} usulan {b} sudah tercatat ya! {e} Yang paling banyak disukai dibangun lebih dulu, jadi ajak teman-temanmu like komen ini 👍',
  '@{u} {b} masuk daftar usulan! {e} Pantau terus desa ini, siapa tahu besok yang dibangun usulanmu 🙌',
  '@{u} oke, {b} dicatat Mayor Budi. {e} Makin banyak like, makin besar peluangnya dibangun duluan 👷',
  '@{u} siap, {b} sudah masuk catatan Mayor Budi {e} Tunggu update desa tiap malam ya! 📝',
  '@{u} makasih usulannya! {e} {b} tercatat, nantikan update desa selanjutnya ya 🙏',
  '@{u} tercatat ya, {b} masuk daftar! {e} Terima kasih sudah ikut membangun desa 🏘️',
];
const T_NOBUILD = [     // permintaan di luar pilihan: cukup dicatat, tidak menjanjikan
  '@{u} {e} makasih usulannya! Sudah dicatat ya 🙏',
  '@{u} {e} usulannya menarik, dicatat dulu ya! Terima kasih 🙌',
  '@{u} {e} tercatat ya! Makasih sudah kasih usulan buat desa ini 📝',
  '@{u} {e} terima kasih usulannya, sudah masuk catatan Mayor Budi 👷',
  '@{u} {e} ide bagus, dicatat dulu ya. Makasih udah ikut meramaikan desa! ✨',
  '@{u} {e} makasih ya, usulanmu tercatat! Pantau terus update desa tiap malam 🏘️',
];
const T_WELCOME = [     // sapaan, emoji, "sudah follow", dll -> ajak pilih job (Day 4)
  '@{u} makasih ya! {e} Sekarang kamu warga desa ini 🏡 Pilih jobmu: komen KNIGHT, MAGE, atau RANGER ⚔️',
  '@{u} halo warga! {e} Perang besar akan datang, pilih jobmu dulu ya: KNIGHT, MAGE, atau RANGER 🛡️',
  '@{u} selamat datang di desa! {e} Komen jobmu sekarang: KNIGHT, MAGE, atau RANGER ⚔️',
  '@{u} terima kasih sudah jadi warga! {e} Mau jadi apa saat perang? Komen KNIGHT, MAGE, atau RANGER 🏹',
];
const T_SORRY = [       // komentar kecewa / merasa tidak dianggap
  '@{u} maaf ya, kamu tidak dicuekin kok! 🥺 Komenmu sudah terbaca. Pilih jobmu: KNIGHT, MAGE, atau RANGER 🙏',
  '@{u} waduh, maaf banget! 🥺 Sekarang sudah terbaca kok. Tulis jobmu ya: KNIGHT, MAGE, atau RANGER 🙏',
  '@{u} maaf ya kalau sempat kelewat 😢 Sekarang sudah terbaca! Komen jobmu: KNIGHT, MAGE, atau RANGER 💪',
];
const T_JOB = {         // pilihan job (Day 4): {j} = nama job
  KNIGHT: [
    '@{u} siap, kamu tercatat jadi KNIGHT! 🛡️ Garis depan desa ini sekarang punya kamu ⚔️',
    '@{u} KNIGHT dicatat Mayor Budi! 🛡️ Siap jadi tameng desa saat perang besar ⚔️',
    '@{u} oke, jobmu KNIGHT! ⚔️ Pedang dan perisai menunggu kamu 🛡️',
  ],
  MAGE: [
    '@{u} siap, kamu tercatat jadi MAGE! 🔮 Sihirmu ditunggu saat perang besar ✨',
    '@{u} MAGE dicatat Mayor Budi! 🪄 Siap jadi penyihir desa ini ✨',
    '@{u} oke, jobmu MAGE! 🔮 Tongkat sihirmu sudah disiapkan 🪄',
  ],
  RANGER: [
    '@{u} siap, kamu tercatat jadi RANGER! 🏹 Panahmu ditunggu saat perang besar 🎯',
    '@{u} RANGER dicatat Mayor Budi! 🏹 Siap jadi pemanah desa ini 🎯',
    '@{u} oke, jobmu RANGER! 🎯 Busur dan panah sudah disiapkan 🏹',
  ],
};
const JOB_CTA = ' Pilih jobmu juga: KNIGHT, MAGE, atau RANGER ⚔️';
function detectJob(text) {
  const t = String(text);
  const m = t.match(/\b(knight|ksatria|swordman|swordsman|pedang)\b|\b(mage|penyihir|sihir)\b|\b(r[ae]ng+[ae]r|archer|pemanah|panah)\b/i);
  if (!m) return null;
  return m[1] ? 'KNIGHT' : m[2] ? 'MAGE' : 'RANGER';
}
const T_MULTI = [       // satu komentar berisi banyak permintaan
  '@{u} wah, daftarnya lengkap banget! 😄 Mayor Budi catat semuanya, tapi dibangun satu per satu ya. Terima kasih usulannya 🙌',
  '@{u} semangat banget usulannya! 🤩 Semua tercatat ya, nanti dibangun bertahap. Makasih 🙏',
  '@{u} banyak ide bagus nih! 😍 Sudah dicatat semua, tunggu update desa tiap malam ya 📝',
];
const T_KELUAR = [
  '@{u} siap, permintaanmu dicatat. Terima kasih sudah mampir ke desa ini 🙏',
  '@{u} oke, dicatat ya. Makasih sudah mampir, kapan-kapan main lagi 👋',
];

function pickReply(c) {
  const text = String(c.text || '');
  const h = hashStr(c.id);
  let list, b = '', e = pick(GENERIC_EMO, h);
  const own = (text.match(/\p{Extended_Pictographic}/u) || [])[0];       // emoji yang dipakai si pengomentar
  const items = text.split(/,|\bsama\b|\bdan\b|\bserta\b/i).filter(x => x.trim().length > 2).length;
  const buildable = /rumah sakit|rumah ibadah/i.test(text) ? null : parseBuild(text);  // "rumah sakit" bukan "rumah"
  const job = detectJob(text);
  if (job) return pick(T_JOB[job], h).replace('{u}', c.username);
  if (/\bkeluar\b/i.test(text)) list = T_KELUAR;
  else if (/(ga|gak|nggak|tidak|ngga|belum)\s*(di)?(anggap|notice|bales|balas|respon)|dicuekin|diabaikan|cuek/i.test(text)) list = T_SORRY;
  else if (items >= 3) list = T_MULTI;
  else if (buildable) { list = T_BUILD; b = NAMA[buildable] || buildable; e = pick(EMO_BUILD[buildable] || GENERIC_EMO, h >>> 3); }
  else if (/\b(bangun|bikin|buat|buatin|dong|minta|tambah)/i.test(text)) { list = T_NOBUILD; e = emojiFor(text, h >>> 3); }
  else { list = T_WELCOME; e = own || pick(['🙌', '😊', '🎉'], h >>> 3); }
  let out = pick(list, h).replace('{u}', c.username).replace('{b}', b).replace('{e}', e);
  if ([T_BUILD, T_NOBUILD, T_MULTI].includes(list)) out += JOB_CTA;       // Day 4: semua balasan ajak pilih job
  return out;
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
  const todo = [];
  for (const m of media.data || []) {
    let r = await call('GET', `/${m.id}/comments`, { fields: 'id,text,username,timestamp,replies{username}', limit: 50 });
    for (let page = 0; r && page < 5; page++) {
      for (const c of r.data || []) {
        if (!c.id || !c.username || !c.text) continue;
        if (c.username.toLowerCase() === me.toLowerCase()) continue;       // komentar sendiri
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
    const msg = pickReply(c);
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
    await sleep(4000);
  }
  if (!DRY) fs.writeFileSync(FILE, JSON.stringify({ ids: [...done].slice(-5000), day: today, count: countToday }));
  console.log(`Selesai. Terkirim: ${sent}.`);
}

if (require.main === module) main().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
module.exports = { pickReply };
