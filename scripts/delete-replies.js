// Hapus SEMUA balasan komentar yang dibuat akun sendiri (@pohonwarga) di post TERBARU saja (Day 4).
// Pakai: node scripts/delete-replies.js [--dry]   (--dry hanya menghitung/mencetak, tidak menghapus)
// Tidak mengubah site/data/replied.json, jadi komentar lama tidak dibalas ulang.
const BASE = `https://${process.env.IG_API_HOST || 'graph.facebook.com'}/v21.0`;
const DRY = process.argv.includes('--dry');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(method, p, params = {}) {
  const url = new URL(BASE + p);
  const body = new URLSearchParams({ access_token: process.env.IG_TOKEN, ...params });
  let res;
  if (method === 'GET') { body.forEach((v, k) => url.searchParams.set(k, v)); res = await fetch(url); }
  else res = await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${p}: ${j.error ? j.error.message : res.status}`);
  return j;
}
(async () => {
  const uid = process.env.IG_USER_ID;
  if (!process.env.IG_TOKEN || !uid) throw new Error('IG_TOKEN / IG_USER_ID belum diisi');
  const me = (await call('GET', `/${uid}`, { fields: 'username' })).username.toLowerCase();
  const media = await call('GET', `/${uid}/media`, { fields: 'id,timestamp,permalink,caption', limit: 12 });
  media.data = (media.data || []).slice(0, 1);                         // HANYA post terbaru (Day 4)
  for (const m of media.data) console.log(`Post sasaran: ${m.permalink} (${m.timestamp}) "${String(m.caption || '').slice(0, 50).replace(/\n/g, ' ')}"`);
  const mine = [];
  for (const m of media.data || []) {
    let r = await call('GET', `/${m.id}/comments`, { fields: 'id,username,text,replies{id,username,text}', limit: 50 });
    for (let page = 0; r && page < 10; page++) {
      for (const c of r.data || []) {
        if ((c.username || '').toLowerCase() === me) continue;
        for (const x of (c.replies && c.replies.data) || []) if ((x.username || '').toLowerCase() === me) mine.push({ id: x.id, parent: c.id, to: c.username, text: x.text });
      }
      r = r.paging && r.paging.next ? await (await fetch(r.paging.next)).json() : null;
    }
  }
  console.log(`${mine.length} balasan milik @${me} ditemukan.${DRY ? ' MODE DRY: tidak menghapus.' : ''}`);
  let ok = 0, fail = 0; const gone = new Set();
  for (const x of mine) {
    if (DRY) { console.log(`- ke @${x.to}: ${String(x.text).slice(0, 70)}`); continue; }
    try { await call('DELETE', `/${x.id}`); ok++; gone.add(x.parent); console.log(`Terhapus (ke @${x.to})`); }
    catch (e) { fail++; console.log(`Gagal hapus (ke @${x.to}): ${e.message}`); }
    await sleep(1500);
  }
  if (!DRY && gone.size) {   // komentar yang balasannya dihapus boleh dibalas lagi dengan template baru
    const f = require('path').join(__dirname, '..', 'site', 'data', 'replied.json'); const fs = require('fs');
    try { const st = JSON.parse(fs.readFileSync(f, 'utf8')); st.ids = (st.ids || []).filter(i => !gone.has(i)); fs.writeFileSync(f, JSON.stringify(st)); console.log(`${gone.size} komentar dibuka lagi untuk dibalas template baru.`); } catch (e) { console.log('replied.json tidak diubah: ' + e.message); }
  }
  console.log(`Selesai. Terhapus: ${ok}, gagal: ${fail}.`);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
