// Hitung pilihan job dari komentar Instagram (KNIGHT / MAGE / RANGER). Tanpa AI.
// Pakai: node scripts/jobs.js [--dry]   Env: IG_TOKEN, IG_USER_ID
// Aturan: komentar TERBARU tiap warga yang menyebut job menang. Hanya follower (manual/followers.txt) bila daftarnya ada.
// Hasil: site/data/job-votes.json = { updated, counts:{KNIGHT,MAGE,RANGER}, votes:{username:JOB} }
const fs = require('fs'), path = require('path');
const { detectJob } = require('./reply');
const BASE = `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/v21.0`;
const OUT = path.join(__dirname, '..', 'site', 'data', 'job-votes.json');
const DRY = process.argv.includes('--dry');
async function call(p, params = {}) {
  const url = new URL(BASE + p); url.searchParams.set('access_token', process.env.IG_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url); const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${p}: ${j.error ? j.error.message : res.status}`);
  return j;
}
(async () => {
  const uid = process.env.IG_USER_ID; if (!process.env.IG_TOKEN || !uid) throw new Error('IG_TOKEN / IG_USER_ID belum diisi');
  const me = (await call(`/${uid}`, { fields: 'username' })).username.toLowerCase();
  let followers = null;
  try { const f = fs.readFileSync(path.join(__dirname, '..', 'manual', 'followers.txt'), 'utf8').split(/\r?\n/).map(x => x.trim().replace(/^@/, '').toLowerCase()).filter(x => x && !x.startsWith('#')); if (f.length) followers = new Set(f); } catch {}
  const media = await call(`/${uid}/media`, { fields: 'id', limit: 12 });
  const all = [];
  for (const m of media.data || []) {
    let r = await call(`/${m.id}/comments`, { fields: 'id,text,username,timestamp', limit: 50 });
    for (let page = 0; r && page < 10; page++) { for (const c of r.data || []) all.push(c); r = r.paging && r.paging.next ? await (await fetch(r.paging.next)).json() : null; }
  }
  all.sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0));
  const votes = {};
  for (const c of all) {
    const u = (c.username || '').toLowerCase(); if (!u || u === me || !c.text) continue;
    if (followers && !followers.has(u)) continue;
    const j = detectJob(c.text); if (j) votes[u] = j;
  }
  const counts = { KNIGHT: 0, MAGE: 0, RANGER: 0 }; Object.values(votes).forEach(j => counts[j]++);
  console.log(`Pilihan job: ${Object.keys(votes).length} warga. KNIGHT ${counts.KNIGHT}, MAGE ${counts.MAGE}, RANGER ${counts.RANGER}${followers ? '' : ' (daftar follower tidak ditemukan: semua komentator dihitung)'}`);
  if (DRY) return;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), counts, votes }));
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
