// Jalankan satu hari simulasi: node scripts/daily.js [--fake] [--dry]
// Tanpa IG_TOKEN (atau dengan --fake) memakai komentar palsu agar bisa diuji.
const fs = require('fs'), path = require('path');
const { step, newWorld, rng } = require('../engine/engine');
const { fetchInput } = require('./ig');
const FOLLOWERS = process.env.FOLLOWERS_FILE || path.join(__dirname, '..', 'manual', 'followers.txt');
const MANUAL = process.env.MANUAL_FILE || path.join(__dirname, '..', 'manual', 'input.txt');

const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'site', 'data');
const KEEP_DAYS = 30;
const args = process.argv.slice(2);
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const write = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v));
const todayWIB = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function fakeInput(day) {
  const r = rng('fake-' + day), words = ['bikin warung dong', 'jembatan!', 'rumah kecil', 'sumur', 'menara ronda', 'kebun bunga', 'lampion', 'balai warga', 'halo semua'];
  const followers = 1 + day * 3 + Math.floor(r() * 5), comments = [];
  for (let i = 0; i < 2 + Math.floor(r() * 4); i++) comments.push({ id: `f${day}-${i}`, user: 'warga' + Math.floor(r() * (followers + 5)), text: words[Math.floor(r() * words.length)], likes: Math.floor(r() * 20), ts: i });
  return { followers, comments, newIds: comments.map(c => c.id) };
}

// Input manual: baris "followers: N" dan "@user teks komentar". Mengembalikan null kalau kosong.
function manualInput(world) {
  let raw; try { raw = fs.readFileSync(MANUAL, 'utf8'); } catch { return null; }
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) return null;
  let followers = world.population || 1; const comments = []; const day = world.day + 1;
  for (const l of lines) {
    const f = l.match(/^followers\s*:\s*(\d+)$/i); if (f) { followers = parseInt(f[1], 10); continue; }
    const m = l.match(/^@?([A-Za-z0-9._]{1,30})\s+(.+)$/); if (!m) { console.log('Baris dilewati (format salah):', l); continue; }
    comments.push({ id: `m${day}-${comments.length}`, user: m[1].toLowerCase(), text: m[2], likes: 0, ts: comments.length });
  }
  followers = Math.max(followers, new Set(comments.map(c => c.user)).size);
  return { followers, comments, newIds: comments.map(c => c.id), manual: true };
}

(async () => {
  fs.mkdirSync(DATA, { recursive: true });
  let world = read('world.json', null) || newWorld(todayWIB());
  const cursor = read('cursor.json', { seen: [] });
  // Satu hari simulasi per tanggal WIB: kalau hari ini sudah dijalankan (mis. manual), run terjadwal tidak maju lagi. Paksa dengan --force.
  if (!args.includes('--force') && !args.includes('--fake') && !args.includes('--dry') && world.day > 0 && world.date >= todayWIB()) { console.log(`Hari ${world.day} (${world.date}) sudah dijalankan hari ini, dilewati. Pakai --force untuk memaksa.`); return; }
  const useFake = args.includes('--fake');
  let input, source;
  if (useFake) { input = fakeInput(world.day + 1); source = 'DATA PALSU'; }
  else if (process.env.IG_TOKEN) { input = await fetchInput({ token: process.env.IG_TOKEN, igUserId: process.env.IG_USER_ID, seen: new Set(cursor.seen) }); source = 'Instagram'; }
  else { input = manualInput(world); source = 'Input manual'; }
  if (!input) { console.log('Tidak ada IG_TOKEN dan manual/input.txt kosong, dilewati.'); return; }
  try { input.followerNames = fs.readFileSync(FOLLOWERS, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')); } catch { input.followerNames = []; }
  if (input.followerNames.length) input.followers = Math.max(input.followers, input.followerNames.length);
  console.log(`${source}: ${input.followers} followers, ${input.comments.length} komentar baru`);

  const out = step(world, { followers: input.followers, comments: input.comments, followerNames: input.followerNames });
  if (args.includes('--dry')) { console.log(JSON.stringify(out.log.stats)); return; }

  const days = read('days.json', []); days.push(out.log);
  write('world.json', out.state);
  write('days.json', days.slice(-KEEP_DAYS));
  write('cursor.json', { seen: [...cursor.seen, ...input.newIds].slice(-5000) });
  if (input.manual && !args.includes('--keep')) fs.writeFileSync(MANUAL, '# Sudah diproses. Tempel komentar hari berikutnya di bawah ini, satu per baris: @username teks komentar\n# Baris pertama (opsional): followers: 25\n');
  console.log(`Hari ${out.log.day}:`, JSON.stringify(out.log.stats));
})().catch(e => { console.error(e.message); process.exit(1); });
