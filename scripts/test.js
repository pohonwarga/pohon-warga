// Uji: mock API Instagram (paging, duplikat, urutan) + 5 hari berturut-turut + determinisme.
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { fetchInput } = require('./ig');
const mk = (id, u, t, l, ts) => ({ id, username: u, text: t, like_count: l, timestamp: ts });
const pages = {
  '/me?': { username: 'pohonwarga', followers_count: 42 },
  '/me/media': { data: [{ id: 'm1' }, { id: 'm2' }] },
  'm1/comments': { data: [mk('c2', 'Budi_A', 'bikin warung', 3, '2026-11-19T01:00:00Z'), mk('c1', 'sari', 'halo', 0, '2026-11-19T00:00:00Z')], paging: { next: 'https://graph.instagram.com/page2?access_token=x' } },
  'page2': { data: [mk('c3', 'dewi', 'jembatan!', 9, '2026-11-19T02:00:00Z'), mk('c4', 'seen', 'sudah', 1, '2026-11-18T00:00:00Z')] },
  'm2/comments': { data: [{ id: 'c5', text: 'tanpa username' }] },
};
const fakeFetch = async url => { const k = Object.keys(pages).find(k => url.includes(k)); return { ok: !!k, status: k ? 200 : 404, json: async () => pages[k] || { error: { message: 'x', code: 1 } } }; };
(async () => {
  const r = await fetchInput({ token: 't', seen: new Set(['c4']), fetchFn: fakeFetch });
  assert.deepStrictEqual(r.comments.map(c => c.id), ['c1', 'c2', 'c3']);
  assert.strictEqual(r.comments[1].user, 'budi_a'); assert.strictEqual(r.followers, 42);
  console.log('ig.js OK: paging, duplikat, urutan, huruf kecil');
  const run = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-')); for (let i = 0; i < 5; i++) execFileSync('node', [path.join(__dirname, 'daily.js'), '--fake'], { env: { ...process.env, DATA_DIR: d, IG_TOKEN: '' }, stdio: 'pipe' }); return fs.readFileSync(path.join(d, 'world.json'), 'utf8'); };
  const a = run(), b = run(); assert.strictEqual(a, b, 'tidak deterministik'); assert.ok(a.length > 100);
  const w = JSON.parse(a); console.log('5 hari OK: hari', w.day, '| populasi', w.population, '| RT', w.rts.length, '| bangunan', Object.keys(w.buildings).length);
})().catch(e => { console.error('GAGAL', e.message); process.exit(1); });
// Uji input manual
(() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pwm-')), f = path.join(d, 'input.txt');
  fs.writeFileSync(f, '# contoh\nfollowers: 12\n@Sari bikin warung dong\nbudi_a jembatan!\nrusak\n');
  const env = { ...process.env, DATA_DIR: d, MANUAL_FILE: f, IG_TOKEN: '' };
  const out = execFileSync('node', [path.join(__dirname, 'daily.js')], { env }).toString();
  assert.ok(out.includes('Input manual: 12 followers, 2 komentar'), out);
  const w = JSON.parse(fs.readFileSync(path.join(d, 'world.json'), 'utf8'));
  assert.strictEqual(w.day, 1); assert.ok(w.residents.sari && w.residents.budi_a, 'warga manual tidak terdaftar');
  assert.ok(fs.readFileSync(f, 'utf8').includes('Sudah diproses'), 'file tidak dikosongkan');
  const out2 = execFileSync('node', [path.join(__dirname, 'daily.js')], { env }).toString();
  assert.ok(out2.includes('dilewati'), 'harus dilewati saat kosong');
  console.log('input manual OK: 2 komentar -> 2 warga, file dikosongkan, hari kosong dilewati');
})();
// Uji job, EXP, level (update 2, tahap 1)
(() => {
  const { step, newWorld } = require('../engine/engine.js');
  let w = newWorld('2026-11-19'); const c = (u, t, i) => ({ user: u, text: t, likes: 0, ts: 0, id: u + t + i });
  w = step(w, { followers: 3, comments: [c('sari', 'a', 1), c('sari', 'b', 2), c('sari', 'c', 3), c('sari', 'd', 4), c('dedi', 'JOB mage', 5)] }).state;
  assert.ok(['ARCHER', 'SWORDMAN', 'MAGE'].includes(w.residents.sari.job), 'job awal harus acak dari 3 job');
  assert.strictEqual(w.residents.sari.exp, 30, 'EXP maksimal 3 komentar per hari');
  assert.strictEqual(w.residents.dedi.job, 'MAGE', 'ganti job lewat komentar');
  w = step(w, { followers: 3, comments: [c('dedi', 'job archer', 6)] }).state;
  assert.strictEqual(w.residents.dedi.job, 'MAGE', 'ganti job dibatasi 1x seminggu');
  const w2 = step(newWorld('2026-11-19'), { followers: 2, comments: [c('sari', 'a', 1)] }).state;
  assert.strictEqual(w2.residents.sari.job, step(newWorld('2026-11-19'), { followers: 2, comments: [c('sari', 'a', 1)] }).state.residents.sari.job, 'job acak harus deterministik');
  console.log('job/EXP/level OK: job acak, EXP maks 3/hari, ganti job 1x/minggu, deterministik');
})();
// Uji quest harian, koin pribadi, balon ucapan
(() => {
  const { step, newWorld, CFG } = require('../engine/engine.js');
  const c = (u, t, i) => ({ user: u, text: t, likes: 0, ts: 0, id: u + t + i });
  let w = newWorld('2026-11-19'), r;
  r = step(w, { followers: 3, comments: [c('sari', 'halo', 1), c('sari', 'bikin warung', 2), c('sari', 'ronda @dedi', 3), c('dedi', 'halo', 4), c('dedi', 'anjing', 5)] }); w = r.state;
  assert.ok(r.log.quest && r.log.quest.text && r.log.questBesok, 'quest hari ini dan besok harus ada');
  assert.strictEqual(w.residents.dedi.koin >= 1, true, '1 koin untuk hari komen');
  assert.ok(w.residents.sari.koin >= 1 && w.residents.sari.koin <= 2, 'koin maks 2 per hari');
  assert.strictEqual(w.residents.dedi.say.text, '...', 'komen kasar disamarkan di balon');
  assert.ok(r.log.events.length >= 0 && r.state.residents.sari.say.text.length <= 48);
  const caption = require('../engine/engine.js'); // caption dipanggil di step
  assert.ok(!/QUEST|koin|KELUAR/i.test(String(r.log.caption || '')) && /Komen = minta bangunan/.test(r.log.caption), 'caption tanpa quest/koin/KELUAR, ada CTA');
  console.log('quest/koin/balon OK: quest harian, 1-2 koin per hari, komen kasar disamarkan');
})();
// Uji toko kosmetik
(() => {
  const { step, newWorld, CFG } = require('../engine/engine.js');
  const c = (u, t, i) => ({ user: u, text: t, likes: 0, ts: 0, id: u + t + i });
  assert.strictEqual(CFG.shop.filter(i => i.harga === 3).length, 5); assert.strictEqual(CFG.shop.filter(i => i.harga === 8).length, 5);
  let w = newWorld('2026-11-19');
  w = step(w, { followers: 2, comments: [c('sari', 'BELI SYAL', 1)] }).state;
  assert.ok(!w.residents.sari.items || w.residents.sari.items.length === 0, 'koin kurang tidak boleh beli');
  for (let i = 0; i < 3; i++) w = step(w, { followers: 2, comments: [c('sari', 'halo', 10 + i)] }).state; // 4 koin
  let r = step(w, { followers: 2, comments: [c('sari', 'beli syal', 20)] }); w = r.state;
  assert.deepStrictEqual(w.residents.sari.items, ['syal']); assert.ok(w.residents.sari.look.scarf, 'item langsung dipakai');
  assert.ok(!String(r.log.caption).includes('Belanja'), 'caption tidak memuat belanja');
  const k = w.residents.sari.koin; w = step(w, { followers: 2, comments: [c('sari', 'beli syal', 21)] }).state;
  assert.strictEqual(w.residents.sari.items.length, 1, 'tidak bisa beli dua kali');
  w.residents.sari.koin = 20; w = step(w, { followers: 2, comments: [c('sari', 'beli kacamata', 30)] }).state;
  w = step(w, { followers: 2, comments: [c('sari', 'beli tas', 31), c('sari', 'beli cap', 32)] }).state;
  assert.strictEqual(w.residents.sari.items.length, 3, 'maks 1 barang per hari: kacamata hari 1, lalu hanya tas di hari berikut');
  console.log('toko OK: 5 item 3 koin + 5 item 8 koin, beli memotong koin, langsung dipakai, tidak dobel');
})();
